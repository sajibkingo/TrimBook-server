export function verifyAdmin(req, res, next) {
    if (!req.user) {
        return res
            .status(401)
            .json({ message: "Unauthorized: User not authenticated" });
    }

    const role = String(req.user.role || "")
        .toLowerCase()
        .trim();

    if (role !== "admin") {
        return res
            .status(403)
            .json({ message: "Forbidden: Admin access required" });
    }

    next();
}