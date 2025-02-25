import { 
    SESClient, 
    VerifyEmailIdentityCommand,
    GetIdentityVerificationAttributesCommand,
    IdentityVerificationAttributes,
    ListIdentitiesCommand,
    ListIdentitiesCommandOutput
} from "@aws-sdk/client-ses";

export class SESService {
    private static client = new SESClient({ region: process.env.AWS_REGION });

    static async registerEmail(email: string): Promise<void> {
        try {
            // First check if the email identity exists
            const identityExists = await this.checkIdentityExists(email);
            
            if (identityExists) {
                // If exists, check verification status
                const verificationStatus = await this.checkEmailVerificationStatus(email);
                
                if (verificationStatus === 'Success') {
                    console.log(`Email ${email} is already verified`);
                    return;
                }
                console.log(`Email ${email} exists but is not verified. Current status: ${verificationStatus}`);
            } else {
                // If identity doesn't exist, create it
                console.log(`Creating new email identity for ${email}`);
                const createCommand = new VerifyEmailIdentityCommand({
                    EmailAddress: email
                });
                await this.client.send(createCommand);
                console.log(`Verification email sent to ${email}`);
            }
            
        } catch (error) {
            console.error('Error registering email with SES:', error);
            throw new Error('Failed to register email for notifications');
        }
    }

    private static async checkIdentityExists(email: string): Promise<boolean> {
        try {
            const command = new ListIdentitiesCommand({
                IdentityType: 'EmailAddress',
                MaxItems: 1000
            });

            const response: ListIdentitiesCommandOutput = await this.client.send(command);
            return response.Identities?.includes(email) || false;
        } catch (error) {
            console.error('Error checking identity existence:', error);
            return false;
        }
    }

    private static async checkEmailVerificationStatus(email: string): Promise<string> {
        try {
            const command = new GetIdentityVerificationAttributesCommand({
                Identities: [email]
            });

            const response: any = await this.client.send(command);
            const attributes: IdentityVerificationAttributes = response.VerificationAttributes[email];
            
            return attributes?.VerificationStatus || 'NotFound';
        } catch (error) {
            console.error('Error checking verification status:', error);
            return 'NotFound';
        }
    }
} 