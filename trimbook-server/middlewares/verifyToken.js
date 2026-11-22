import { ObjectId } from "mongodb";

export function createVerifyToken(db) {
    return async function verifyToken(req, res, next) {
        try {
            let token = "";

            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                token = authHeader.slice(7).trim();
            }

            if (!token && req.headers.cookie) {
                const cookies = req.headers.cookie.split(";").reduce((acc, item) => {
                    const [key, ...valParts] = item.trim().split("=");
                    if (key) acc[key] = decodeURIComponent(valParts.join("="));
                    return acc;
                }, {});

                const rawCookie =
                    cookies["__Secure-better-auth.session_token"] ||
                    cookies["better-auth.session_token"] ||
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

            const sessionsCollection = db.collection("session");
            const usersCollection = db.collection("user");

            const session = await sessionsCollection.findOne({ token });

            if (!session) {
                return res
                    .status(401)
                    .json({ message: "Unauthorized: Invalid or expired session" });
            }

            if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
                return res
                    .status(401)
                    .json({ message: "Unauthorized: Session expired" });
            }

            const userId = session.userId;
            const userFilter = ObjectId.isValid(String(userId))
                ? {
                    $or: [
                        { _id: new ObjectId(String(userId)) },
                        { _id: String(userId) },
                    ],
                }
                : { _id: String(userId) };

            const user = await usersCollection.findOne(userFilter);

            if (!user) {
                return res.status(401).json({ message: "Unauthorized: User not found" });
            }

            if (user.isBlocked) {
                return res
                    .status(403)
                    .json({ message: "Your account has been suspended by an administrator." });
            }

            req.user = user;
            req.session = session;
            next();
        } catch (error) {
            console.error("Token verification error:", error);
            res.status(401).json({ message: "Unauthorized: Session verification failed" });
        }
    };
}