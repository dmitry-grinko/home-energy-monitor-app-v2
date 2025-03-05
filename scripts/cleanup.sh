#!/bin/bash

delete_s3_bucket() {
    BUCKET_NAME=$1

    if [ -z "$BUCKET_NAME" ]; then
        echo "Usage: delete_s3_bucket <bucket-name>"
        return 1
    fi

    echo "🔄 Deleting all objects from bucket: $BUCKET_NAME"

    # Delete all objects (non-versioned)
    aws s3 rm s3://$BUCKET_NAME --recursive

    # Delete all versioned objects
    aws s3api list-object-versions --bucket "$BUCKET_NAME" --query 'Versions[*].{Key:Key,VersionId:VersionId}' --output json | \
        jq -c '. // [] | {Objects: .}' | \
        aws s3api delete-objects --bucket "$BUCKET_NAME" --delete file:///dev/stdin 2>/dev/null

    # Delete all delete markers
    aws s3api list-object-versions --bucket "$BUCKET_NAME" --query 'DeleteMarkers[*].{Key:Key,VersionId:VersionId}' --output json | \
        jq -c '. // [] | {Objects: .}' | \
        aws s3api delete-objects --bucket "$BUCKET_NAME" --delete file:///dev/stdin 2>/dev/null

    # Delete the bucket
    echo "🗑️ Deleting bucket: $BUCKET_NAME"
    aws s3 rb s3://$BUCKET_NAME --force

    echo "✅ Bucket $BUCKET_NAME deleted successfully!"
} 