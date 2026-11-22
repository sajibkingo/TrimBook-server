import { ObjectId } from "mongodb";

export function createVerifyToken(db) {
    const usersCollection = db.collection("user");
    const sessionsCollection = db.collection("session");

    return async function verifyToken(req, res, next) {
        try {
            let token = "";

            // 1. Check Authorization Bearer header
            const authHeader = req.headers.authorization || "";
            if (authHeader.startsWith("Bearer ")) {
                token = authHeader.slice(7).trim();
            }

            // 2. Fallback to BetterAuth session cookie if Bearer header is missing
            if (!token && req.headers.cookie) {
                const cookies = req.headers.cookie.split(";").reduce((acc, part) => {
                    const [key, ...val] = part.trim().split("=");
                    if (key) acc[key] = decodeURIComponent(val.join("="));
                    return acc;
                }, {});

                const rawCookie =
                    cookies["better-auth.session_token"] ||
                    cookies["__Secure-better-auth.session_token"] ||
                    "";

                if (rawCookie) {
                    token = rawCookie.split(".")[0];
                }
            }

            if (!token) {
                return res
                    .status(401)
                    .json({ message: "Unauthorized: Missing session token" });
            }

            const session = await sessionsCollection.findOne({ token });
            if (!session) {
                return res
                    .status(401)
                    .json({ message: "Unauthorized: Invalid or expired session" });
            }

            if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
                return res
                    .status(401)
                    .json({ message: "Unauthorized: Session has expired" });
            }

            const userId = session.userId;
            const userFilter = ObjectId.isValid(userId)
                ? { $or: [{ _id: new ObjectId(userId) }, { _id: String(userId) }] }
                : { _id: String(userId) };

            const user = await usersCollection.findOne(userFilter);
            if (!user) {
                return res
                    .status(401)
                    .json({ message: "Unauthorized: User account not found" });
            }

            if (user.isBlocked) {
                return res
                    .status(403)
                    .json({ message: "Your account has been blocked by an administrator." });
            }

            req.user = user;
            req.session = session;
            next();
        } catch (error) {
            console.error("Token verification error:", error);
            res.status(401).json({ message: "Unauthorized: Verification failed" });
        }
    };
}