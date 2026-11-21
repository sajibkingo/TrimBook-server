import { createRemoteJWKSet, jwtVerify } from "jose";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const JWKS = createRemoteJWKSet(new URL(`${CLIENT_URL}/api/auth/jwks`));

export function createVerifyToken(db) {
    return async function verifyToken(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return res.status(401).json({ message: "Unauthorized: Missing Bearer token" });
            }

            const token = authHeader.split(" ")[1];
            const { payload } = await jwtVerify(token, JWKS, {
                issuer: CLIENT_URL,
                audience: CLIENT_URL,
            });

            const user = await db.collection("user").findOne({ email: payload.email });
            if (!user) {
                return res.status(401).json({ message: "Unauthorized: User does not exist" });
            }

            if (user.isBlocked) {
                return res.status(403).json({ message: "Forbidden: Your account has been blocked" });
            }

            req.user = user;
            next();
        } catch (error) {
            return res.status(401).json({ message: "Unauthorized: Invalid or expired JWT" });
        }
    };
}