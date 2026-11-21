export function verifyAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Admin privileges required" });
    }
    next();
}

export function verifyCustomer(req, res, next) {
    if (!req.user || req.user.role !== "customer") {
        return res.status(403).json({ message: "Forbidden: Customer privileges required" });
    }
    next();
}