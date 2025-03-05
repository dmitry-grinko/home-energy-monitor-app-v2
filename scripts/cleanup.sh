#!/bin/bash

delete_s3_bucket() {
    BUCKET_NAME=$1
    MAX_RETRIES=3
    RETRY_COUNT=0

    if [ -z "$BUCKET_NAME" ]; then
        echo "Usage: delete_s3_bucket <bucket-name>"
        return 1
    fi

    # Check if bucket exists
    if ! aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
        echo "⚠️ Bucket $BUCKET_NAME does not exist. Skipping deletion."
        return 0
    fi

    echo "🔄 Deleting all objects from bucket: $BUCKET_NAME"

    # Delete all objects (non-versioned)
    aws s3 rm s3://$BUCKET_NAME --recursive

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        echo "📦 Attempting to delete versioned objects (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
        
        # Delete all versioned objects
        aws s3api list-object-versions --bucket "$BUCKET_NAME" --query 'Versions[*].{Key:Key,VersionId:VersionId}' --output json | \
            jq -c '.[] | select(. != null) | {Objects: [.]}' | \
            while read -r line; do
                if [ ! -z "$line" ]; then
                    echo "$line" | aws s3api delete-objects --bucket "$BUCKET_NAME" --delete file:///dev/stdin 2>/dev/null
                fi
            done

        # Delete all delete markers
        aws s3api list-object-versions --bucket "$BUCKET_NAME" --query 'DeleteMarkers[*].{Key:Key,VersionId:VersionId}' --output json | \
            jq -c '.[] | select(. != null) | {Objects: [.]}' | \
            while read -r line; do
                if [ ! -z "$line" ]; then
                    echo "$line" | aws s3api delete-objects --bucket "$BUCKET_NAME" --delete file:///dev/stdin 2>/dev/null
                fi
            done

        # Check if bucket is empty
        if ! aws s3api list-object-versions --bucket "$BUCKET_NAME" --query 'length(Versions[]) + length(DeleteMarkers[])' --output text 2>/dev/null | grep -q '^0$'; then
            echo "⚠️ Bucket still has objects. Retrying..."
            RETRY_COUNT=$((RETRY_COUNT + 1))
            sleep 2
        else
            break
        fi
    done

    # Final attempt to delete the bucket
    echo "🗑️ Deleting bucket: $BUCKET_NAME"
    if aws s3 rb s3://$BUCKET_NAME --force; then
        echo "✅ Bucket $BUCKET_NAME deleted successfully!"
        return 0
    else
        echo "❌ Failed to delete bucket $BUCKET_NAME after $MAX_RETRIES attempts"
        return 1
    fi
} 