# Home Energy Monitor App V2

## Architecture Diagram

![Architecture](https://raw.githubusercontent.com/dmitry-grinko/home-energy-monitor-app-v2/refs/heads/main/architecture.png)

## Description

The Home Energy Monitoring App is a cloud-based solution that allows users to track and manage their home energy usage effectively. Users can manually input daily energy consumption data or upload CSV files containing historical usage. The app leverages AWS services—Cognito for secure user authentication, API Gateway and Lambda for processing, S3 for file storage, DynamoDB for data management, and SNS for sending alerts when energy thresholds are exceeded. This design ensures scalable data storage, real-time monitoring, and actionable insights through historical trend visualization.

## Deployment Instructions

1. **Fork the Repository**: First, fork this repository.

2. **Set Up Secrets in GitHub Actions**: Add the following secrets in GitHub Actions:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `FROM_EMAIL`
   - `FRONTEND_S3_BUCKET_NAME`
   - `PROJECT_NAME`
   - `ROOT_DOMAIN` (the root domain used in this application is expected to already be set up in Route 53 with a Managed Certificate attached.)

3. **Create S3 Bucket**: Manually create an S3 bucket for Terraform state and update the Terraform code with the bucket details - `terraform/provider.tf`

4. **Git Operations**: Commit and push your changes to the main repository.

## APIs

### Authentication Endpoints

#### `POST /auth/signup`
> Create a new user account and register email for SES notifications.

Request Body:
- email: string
- password: string

Response (201):
- message: "User created. Please check your email for two verification links: one for account verification and another for enabling email notifications."

#### `POST /auth/verify`
> Verify email address with confirmation code.

Request Body:
- email: string
- code: string

Response (200):
- message: "Email verified successfully. You can now login."

#### `POST /auth/login`
> Authenticate user and get access tokens.

Request Body:
- email: string
- password: string

Response (200):
- accessToken: string
- idToken: string
- refreshToken: string (in HTTP-only cookie)

#### `POST /auth/resend-code`
> Resend verification code to email.

Request Body:
- email: string

Response (200):
- message: "Verification code has been resent to your email"

#### `POST /auth/refresh`
> Refresh access tokens using refresh token cookie.

Request: No body required (uses HTTP-only refresh token cookie)

Response (200):
- accessToken: string
- idToken: string

#### `POST /auth/logout`
> Logout user and clear refresh token cookie.

Request: No body required

Response (200):
- message: "Logged out successfully"

#### `POST /auth/forgot-password`
> Initiate password reset process.

Request Body:
- email: string

Response (200):
- message: "Password reset code has been sent to your email"

#### `POST /auth/password-reset`
> Complete password reset with code.

Request Body:
- email: string
- code: string
- newPassword: string

Response (200):
- message: "Password reset successful"

### Energy Usage Endpoints

#### `POST /energy/input`
> Submit new energy usage reading.

Headers:
- Authorization: Bearer {accessToken}
- X-Id-Token: {idToken}

Request Body:
- date: string (YYYY-MM-DD)
- usage: number
- source: string

Response (200):
- message: "Energy data saved successfully"
- data: {
  Date: string,
  EnergyUsage: number,
  Source: string,
  UserId: string,
  TTL: number,
  CreatedAt: string
}

#### `GET /energy/history`
> Retrieve energy usage history for a date range.

Headers:
- Authorization: Bearer {accessToken}
- X-Id-Token: {idToken}

Query Parameters:
- startDate: string (YYYY-MM-DD)
- endDate: string (YYYY-MM-DD)

Response (200):
- message: "Energy history retrieved successfully"
- data: Array of {
  Date: string,
  EnergyUsage: number,
  Source: string,
  UserId: string,
  TTL: number,
  CreatedAt: string
}

#### `GET /energy/summary`
> Get aggregated energy usage summary.

Headers:
- Authorization: Bearer {accessToken}
- X-Id-Token: {idToken}

Query Parameters:
- period: string (daily/weekly/monthly)

Response (200):
- message: "Energy summary retrieved successfully"
- data: Array of {
  period: string,
  totalUsage: number,
  avgUsage: number,
  sourceBreakdown: {
    [source: string]: number
  }
}

#### `GET /energy/download`
> Download energy usage data as CSV.

Headers:
- Authorization: Bearer {accessToken}
- X-Id-Token: {idToken}

Response (200):
- Content-Type: text/csv
- Content-Disposition: attachment; filename="energy-data.csv"
- Body: CSV content

### File Upload Endpoints

#### `GET /presigned-url`
> Get a presigned URL for CSV file upload.

Headers:
- Authorization: Bearer {accessToken}
- X-Id-Token: {idToken}

Response (200):
- presignedUrl: string (valid for 5 minutes)
- fileKey: string

### Alert Endpoints

#### `POST /alerts`
> Set energy usage alert threshold.

Headers:
- Authorization: Bearer {accessToken}
- X-Id-Token: {idToken}

Request Body:
- threshold: number (positive value required)

Response (200):
- message: "Threshold set successfully"

#### `GET /alerts`
> Get current alert threshold.

Headers:
- Authorization: Bearer {accessToken}
- X-Id-Token: {idToken}

Response (200):
- threshold: number

Response (404):
- message: "No threshold found"

### Prediction Endpoints

#### `GET /prediction`
> Get energy usage prediction for a specific date.

Headers:
- Authorization: Bearer {accessToken}
- X-Id-Token: {idToken}

Query Parameters:
- date: string (YYYY-MM-DD)

Response (200):
- date: string
- prediction: number

Response (404):
- message: "No trained model found. Please upload at least 100 energy consumption records to train the prediction model."
- requiresData: true

Response (503):
- message: "The prediction service is temporarily unavailable. Please try again in a few minutes."
OR
- message: "Prediction model is currently {status}. Please try again in a few minutes."
- status: string

### Error Responses

> All endpoints may return these error responses:

401 Unauthorized:
- message: "Unauthorized. Missing required tokens."
- message: "Unauthorized. Invalid tokens."
- message: "Unauthorized. Tokens expired or invalid."
- message: "Unauthorized. Invalid token issuer."

400 Bad Request:
- message: Specific error description

500 Internal Server Error:
- message: "Internal server error"






