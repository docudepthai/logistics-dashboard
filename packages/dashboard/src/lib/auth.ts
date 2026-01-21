import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import crypto from 'crypto';

const COGNITO_USER_POOL_ID = 'eu-central-1_kbo7DP9KO';
const COGNITO_CLIENT_ID = '5gf8tj08naem9ps3djbcuvckb1';
const COGNITO_CLIENT_SECRET = 'sjeg0p8mb8in84clpadg9t6tovb2eafuelmd3a83jvunfbmkgtf';
const REGION = 'eu-central-1';

const cognitoClient = new CognitoIdentityProviderClient({
  region: REGION,
  credentials: process.env.MY_AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});

function calculateSecretHash(username: string): string {
  const message = username + COGNITO_CLIENT_ID;
  return crypto
    .createHmac('sha256', COGNITO_CLIENT_SECRET)
    .update(message)
    .digest('base64');
}

async function authenticateWithCognito(username: string, password: string) {
  try {
    const command = new AdminInitiateAuthCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      ClientId: COGNITO_CLIENT_ID,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: calculateSecretHash(username),
      },
    });

    const response = await cognitoClient.send(command);
    return response.AuthenticationResult ? true : false;
  } catch (error) {
    console.error('Cognito auth error:', error);
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || 'k8X2mP9qR4tY7vN3bF6hJ1wC5sA0dG8eL2iU4oZ9xV7n',
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const isValid = await authenticateWithCognito(
          credentials.username,
          credentials.password
        );

        if (!isValid) {
          return null;
        }

        return {
          id: credentials.username,
          name: credentials.username,
          email: credentials.username,
        };
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.id as string;
      return session;
    },
  },
};
