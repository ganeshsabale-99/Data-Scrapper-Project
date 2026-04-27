import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

export function createOAuth2Client(refreshToken?: string): OAuth2Client {
    const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    if (refreshToken) {
        oAuth2Client.setCredentials({ refresh_token: refreshToken });
    }
    return oAuth2Client;
}

export function getAuthUrl(stateUserId: string): string {
    const oAuth2Client = createOAuth2Client();
    return oAuth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",           
        scope: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/documents",
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/userinfo.email",
        ],
        state: stateUserId,          
    });
}
