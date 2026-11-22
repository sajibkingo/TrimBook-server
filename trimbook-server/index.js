import express from "express";
import "dotenv/config";
import cors from "cors";
import Stripe from "stripe";
import { MongoClient, ObjectId } from "mongodb";
import { createVerifyToken } from "./middlewares/verifyToken.js";
import { verifyAdmin } from "./middlewares/verifyAdmin.js";

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
    process.env.CLIENT_URL,
    "http://localhost:3000",
].filter(Boolean);

app.use(express.json());
app.use(
    cors({
        origin: (origin, callback) => {
            if (
                !origin ||
                allowedOrigins.includes(origin) ||
                origin.endsWith(".vercel.app")
            ) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    })
);

const uri =
    process.env.MONGODB_URI ||
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri);
let dbInstance = null;

async function getDb() {
    if (!dbInstance) {
        await client.connect();
        dbInstance = client.db("trimbook");
    }
    return dbInstance;
}

app.use(async (req, res, next) => {
    try {
        req.db = await getDb();
        next();
    } catch (error) {
        console.error("MongoDB connection error:", error);
        res.status(500).json({ message: "Database connection failed" });
    }
});

const authMiddleware = (req, res, next) => {
    const verifyToken = createVerifyToken(req.db);
    return verifyToken(req, res, next);
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.get("/", (req, res) => {
    res.send("TrimBook API Server is running!");
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
    const currentUserId = req.user._id || req.user.id;
    res.json({
        _id: currentUserId,
        name: req.user.name,
        email: req.user.email,
        image: req.user.image || "",
        phone: req.user.phone || "",
        role: req.user.role || "customer",
        isBlocked: Boolean(req.user.isBlocked),
    });
});

app.patch("/api/users/profile", authMiddleware, async (req, res) => {
    try {
        const usersCollection = req.db.collection("user");
        const { name, phone, image } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Full name is required" });
        }

        const updateFields = {
            name: name.trim(),
            phone: phone ? phone.trim() : "",
            updatedAt: new Date(),
        };

        if (image !== undefined) {
            updateFields.image = String(image).trim();
        }

        const userId = req.user._id || req.user.id;
        const userFilter = ObjectId.isValid(userId)
            ? {
                $or: [
                    { _id: new ObjectId(userId) },
                    { _id: String(userId) },
                    { email: req.user.email },
                ],
            }
            : { $or: [{ _id: String(userId) }, { email: req.user.email }] };

        const updateResult = await usersCollection.updateOne(userFilter, {
            $set: updateFields,
        });

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ message: "User record not found" });
        }

        const updatedUser = await usersCollection.findOne(userFilter);

        res.json({
            message: "Profile updated successfully!",
            user: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                image: updatedUser.image || "",
                phone: updatedUser.phone || "",
                role: updatedUser.role,
                isBlocked: updatedUser.isBlocked,
            },
        });
    } catch (error) {
        console.error("Profile update error:", error);
        res
            .status(500)
            .json({ message: error.message || "Failed to update profile" });
    }
});

app.get("/api/services", async (req, res) => {
    try {
        const servicesCollection = req.db.collection("services");
        const { search, category, sort } = req.query;
        const query = { isAvailable: { $ne: false } };

        if (search && search.trim()) {
            query.serviceName = { $regex: search.trim(), $options: "i" };
        }

        if (category && category !== "All") {
            query.category = category;
        }

        let sortOption = { createdAt: -1 };
        if (sort === "price_asc") {
            sortOption = { price: 1 };
        } else if (sort === "price_desc") {
            sortOption = { price: -1 };
        }

        const services = await servicesCollection
            .find(query)
            .sort(sortOption)
            .toArray();

        res.json(services);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch salon services" });
    }
});

app.get(
    ["/api/services/admin/all", "/api/admin/services"],
    authMiddleware,
    verifyAdmin,
    async (req, res) => {
        try {
            const servicesCollection = req.db.collection("services");
            const services = await servicesCollection
                .find({})
                .sort({ createdAt: -1 })
                .toArray();
            res.json(services);
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch admin services" });
        }
    }
);

app.get("/api/services/:id", async (req, res) => {
    try {
        const servicesCollection = req.db.collection("services");
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid service ID" });
        }

        const service = await servicesCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!service) {
            return res.status(404).json({ message: "Salon service not found" });
        }

        res.json(service);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch service details" });
    }
});

app.post("/api/services", authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const servicesCollection = req.db.collection("services");
        const {
            serviceName,
            category,
            price,
            duration,
            description,
            image,
            isAvailable,
        } = req.body;

        if (!serviceName || !category || !price || !duration || !description) {
            return res
                .status(400)
                .json({ message: "All required service fields must be provided" });
        }

        const newService = {
            serviceName: serviceName.trim(),
            category: category.trim(),
            price: Number(price),
            duration: Number(duration),
            description: description.trim(),
            image: image ? image.trim() : "",
            isAvailable: isAvailable !== false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await servicesCollection.insertOne(newService);
        res.status(201).json({
            message: "Salon service created successfully!",
            serviceId: result.insertedId,
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to create salon service" });
    }
});

app.patch(
    "/api/services/:id",
    authMiddleware,
    verifyAdmin,
    async (req, res) => {
        try {
            const servicesCollection = req.db.collection("services");
            const { id } = req.params;
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid service ID" });
            }

            const allowedFields = [
                "serviceName",
                "category",
                "price",
                "duration",
                "description",
                "image",
                "isAvailable",
            ];
            const updates = { updatedAt: new Date() };

            for (const key of allowedFields) {
                if (req.body[key] !== undefined) {
                    if (key === "price" || key === "duration") {
                        updates[key] = Number(req.body[key]);
                    } else if (key === "isAvailable") {
                        updates[key] = Boolean(req.body[key]);
                    } else {
                        updates[key] = String(req.body[key]).trim();
                    }
                }
            }

            const result = await servicesCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: "Service not found" });
            }

            res.json({ message: "Service updated successfully!" });
        } catch (error) {
            res.status(500).json({ message: "Failed to update service" });
        }
    }
);

app.delete(
    "/api/services/:id",
    authMiddleware,
    verifyAdmin,
    async (req, res) => {
        try {
            const servicesCollection = req.db.collection("services");
            const { id } = req.params;
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid service ID" });
            }

            const result = await servicesCollection.deleteOne({
                _id: new ObjectId(id),
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ message: "Service not found" });
            }

            res.json({ message: "Service deleted successfully!" });
        } catch (error) {
            res.status(500).json({ message: "Failed to delete service" });
        }
    }
);

app.post("/api/appointments", authMiddleware, async (req, res) => {
    try {
        const servicesCollection = req.db.collection("services");
        const appointmentsCollection = req.db.collection("appointments");
        const { serviceId, appointmentDate, timeSlot, message } = req.body;

        if (!serviceId || !appointmentDate || !timeSlot) {
            return res.status(400).json({
                message: "Service, appointment date, and time slot are required",
            });
        }

        if (!ObjectId.isValid(serviceId)) {
            return res.status(400).json({ message: "Invalid service ID" });
        }

        const service = await servicesCollection.findOne({
            _id: new ObjectId(serviceId),
        });

        if (!service || service.isAvailable === false) {
            return res
                .status(404)
                .json({ message: "Selected salon service is not available" });
        }

        const conflict = await appointmentsCollection.findOne({
            serviceId: String(service._id),
            appointmentDate,
            timeSlot,
            status: { $in: ["pending", "confirmed"] },
        });

        if (conflict) {
            return res.status(409).json({
                message:
                    "This time slot is already booked for this treatment. Please choose another slot.",
            });
        }

        const currentUserId = String(req.user._id || req.user.id);

        const newAppointment = {
            userId: currentUserId,
            customerId: currentUserId,
            userName: req.user.name,
            userEmail: req.user.email,
            customerName: req.user.name,
            customerEmail: req.user.email,
            serviceId: String(service._id),
            serviceName: service.serviceName,
            servicePrice: Number(service.price),
            appointmentDate,
            timeSlot,
            message: message ? String(message).trim() : "",
            status: "pending",
            paymentStatus: "unpaid",
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await appointmentsCollection.insertOne(newAppointment);

        res.status(201).json({
            message: "Appointment request submitted successfully!",
            appointmentId: result.insertedId,
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to create appointment" });
    }
});

app.get("/api/appointments/my", authMiddleware, async (req, res) => {
    try {
        const appointmentsCollection = req.db.collection("appointments");
        const servicesCollection = req.db.collection("services");
        const transactionsCollection = req.db.collection("transactions");

        const rawUserId = req.user._id || req.user.id;
        const userIdStr = String(rawUserId);
        const userEmail = req.user.email;

        const orConditions = [
            { customerId: userIdStr },
            { userId: userIdStr },
            { customerEmail: userEmail },
            { userEmail: userEmail },
            { email: userEmail },
        ];

        if (ObjectId.isValid(userIdStr)) {
            const objId = new ObjectId(userIdStr);
            orConditions.push({ customerId: objId });
            orConditions.push({ userId: objId });
        }

        const appointments = await appointmentsCollection
            .find({ $or: orConditions })
            .sort({ createdAt: -1 })
            .toArray();

        const services = await servicesCollection.find({}).toArray();
        const transactions = await transactionsCollection
            .find({
                $or: [
                    { customerEmail: userEmail },
                    { userEmail: userEmail },
                    { email: userEmail },
                    { customerId: userIdStr },
                    { userId: userIdStr },
                ],
            })
            .toArray();

        const serviceMap = new Map(services.map((s) => [String(s._id), s]));
        const txMap = new Map(
            transactions.map((t) => [String(t.appointmentId), t])
        );

        const enriched = appointments.map((apt) => ({
            ...apt,
            serviceInfo: serviceMap.get(String(apt.serviceId)) ||
                apt.serviceInfo || {
                serviceName: apt.serviceName,
                price: apt.servicePrice,
            },
            transactionInfo: txMap.get(String(apt._id)) || null,
        }));

        res.json(enriched);
    } catch (error) {
        console.error("Error fetching /api/appointments/my:", error);
        res.status(500).json({ message: "Failed to fetch your appointments" });
    }
});

app.get(
    ["/api/appointments/admin/all", "/api/admin/appointments"],
    authMiddleware,
    verifyAdmin,
    async (req, res) => {
        try {
            const appointmentsCollection = req.db.collection("appointments");
            const servicesCollection = req.db.collection("services");
            const usersCollection = req.db.collection("user");

            const appointments = await appointmentsCollection
                .find({})
                .sort({ createdAt: -1 })
                .toArray();

            const services = await servicesCollection.find({}).toArray();
            const users = await usersCollection.find({}).toArray();

            const serviceMap = new Map(services.map((s) => [String(s._id), s]));
            const userMap = new Map(users.map((u) => [String(u._id), u]));

            const enriched = appointments.map((apt) => ({
                ...apt,
                serviceInfo:
                    serviceMap.get(String(apt.serviceId)) || apt.serviceInfo || {},
                userInfo: userMap.get(String(apt.customerId || apt.userId)) || {
                    name: apt.userName || apt.customerName,
                    email: apt.userEmail || apt.customerEmail,
                },
            }));

            res.json(enriched);
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch all appointments" });
        }
    }
);

app.patch(
    [
        "/api/appointments/admin/:id/status",
        "/api/admin/appointments/:id/status",
    ],
    authMiddleware,
    verifyAdmin,
    async (req, res) => {
        try {
            const appointmentsCollection = req.db.collection("appointments");
            const { id } = req.params;
            const { status } = req.body;

            if (!["pending", "confirmed", "cancelled"].includes(status)) {
                return res.status(400).json({ message: "Invalid status value" });
            }

            const filter = ObjectId.isValid(id)
                ? { _id: new ObjectId(id) }
                : { _id: id };

            const result = await appointmentsCollection.updateOne(filter, {
                $set: { status, updatedAt: new Date() },
            });

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: "Appointment not found" });
            }

            res.json({ message: `Appointment marked as ${status}` });
        } catch (error) {
            res
                .status(500)
                .json({ message: "Failed to update appointment status" });
        }
    }
);

app.patch("/api/appointments/:id/cancel", authMiddleware, async (req, res) => {
    try {
        const appointmentsCollection = req.db.collection("appointments");
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid appointment ID" });
        }

        const appointment = await appointmentsCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        const currentUserId = String(req.user._id || req.user.id);
        const ownerId = String(
            appointment.customerId || appointment.userId || ""
        );
        const ownerEmail =
            appointment.customerEmail ||
            appointment.userEmail ||
            appointment.email;

        if (ownerId !== currentUserId && ownerEmail !== req.user.email) {
            return res.status(403).json({ message: "Unauthorized action" });
        }

        if (appointment.status !== "pending") {
            return res.status(400).json({
                message: "Only pending appointments can be cancelled by customer",
            });
        }

        await appointmentsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "cancelled", updatedAt: new Date() } }
        );

        res.json({ message: "Appointment cancelled successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to cancel appointment" });
    }
});

app.get(
    ["/api/users/admin/all", "/api/admin/users"],
    authMiddleware,
    verifyAdmin,
    async (req, res) => {
        try {
            const usersCollection = req.db.collection("user");
            const users = await usersCollection
                .find({})
                .sort({ createdAt: -1 })
                .toArray();
            res.json(users);
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch users" });
        }
    }
);

app.patch(
    ["/api/users/admin/:id/role", "/api/admin/users/:id/role"],
    authMiddleware,
    verifyAdmin,
    async (req, res) => {
        try {
            const usersCollection = req.db.collection("user");
            const { id } = req.params;
            const { role } = req.body;

            if (!["customer", "admin"].includes(role)) {
                return res.status(400).json({ message: "Invalid role value" });
            }

            const filter = ObjectId.isValid(id)
                ? { $or: [{ _id: new ObjectId(id) }, { _id: String(id) }] }
                : { _id: String(id) };

            const result = await usersCollection.updateOne(filter, {
                $set: { role, updatedAt: new Date() },
            });

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: "User not found" });
            }

            res.json({ message: `User role updated to ${role}` });
        } catch (error) {
            res.status(500).json({ message: "Failed to update user role" });
        }
    }
);

app.patch(
    ["/api/users/admin/:id/block", "/api/admin/users/:id/block"],
    authMiddleware,
    verifyAdmin,
    async (req, res) => {
        try {
            const usersCollection = req.db.collection("user");
            const { id } = req.params;
            const { isBlocked } = req.body;

            const filter = ObjectId.isValid(id)
                ? { $or: [{ _id: new ObjectId(id) }, { _id: String(id) }] }
                : { _id: String(id) };

            const result = await usersCollection.updateOne(filter, {
                $set: { isBlocked: Boolean(isBlocked), updatedAt: new Date() },
            });

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: "User not found" });
            }

            res.json({
                message: `User ${isBlocked ? "blocked" : "unblocked"} successfully`,
            });
        } catch (error) {
            res
                .status(500)
                .json({ message: "Failed to update user block status" });
        }
    }
);

app.get(
    ["/api/transactions/admin/all", "/api/admin/transactions"],
    authMiddleware,
    verifyAdmin,
    async (req, res) => {
        try {
            const transactionsCollection = req.db.collection("transactions");
            const transactions = await transactionsCollection
                .find({})
                .sort({ createdAt: -1 })
                .toArray();
            res.json(transactions);
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch transactions" });
        }
    }
);

app.post(
    "/api/payments/create-checkout-session",
    authMiddleware,
    async (req, res) => {
        try {
            const appointmentsCollection = req.db.collection("appointments");
            const servicesCollection = req.db.collection("services");
            const { appointmentId } = req.body;

            if (!appointmentId || !ObjectId.isValid(appointmentId)) {
                return res.status(400).json({ message: "Invalid appointment ID" });
            }

            const appointment = await appointmentsCollection.findOne({
                _id: new ObjectId(appointmentId),
            });

            if (!appointment) {
                return res.status(404).json({ message: "Appointment not found" });
            }

            if (appointment.status !== "confirmed") {
                return res.status(400).json({
                    message: "Only confirmed appointments can proceed to payment",
                });
            }

            if (appointment.paymentStatus === "paid") {
                return res
                    .status(400)
                    .json({ message: "This appointment is already paid" });
            }

            let serviceDoc = null;
            if (
                appointment.serviceId &&
                ObjectId.isValid(String(appointment.serviceId))
            ) {
                serviceDoc = await servicesCollection.findOne({
                    _id: new ObjectId(String(appointment.serviceId)),
                });
            }

            const resolvedName =
                appointment.serviceName ||
                appointment.serviceInfo?.serviceName ||
                serviceDoc?.serviceName ||
                "Salon Appointment";

            const resolvedPrice = Number(
                appointment.servicePrice ??
                appointment.price ??
                appointment.serviceInfo?.price ??
                serviceDoc?.price ??
                0
            );

            if (
                !resolvedPrice ||
                Number.isNaN(resolvedPrice) ||
                resolvedPrice <= 0
            ) {
                return res.status(400).json({
                    message: "Invalid service price for this appointment",
                });
            }

            const clientUrl =
                req.headers.origin || process.env.CLIENT_URL || "http://localhost:3000";
            const amountCents = Math.round(resolvedPrice * 100);
            const currentUserId = String(req.user._id || req.user.id);

            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                customer_email: req.user.email,
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            product_data: {
                                name: resolvedName,
                                description: `Date: ${appointment.appointmentDate || "Scheduled"} | Slot: ${appointment.timeSlot || "Confirmed"}`,
                            },
                            unit_amount: amountCents,
                        },
                        quantity: 1,
                    },
                ],
                metadata: {
                    appointmentId: String(appointment._id),
                    userId: currentUserId,
                    customerName:
                        req.user.name ||
                        appointment.userName ||
                        appointment.customerName ||
                        "Customer",
                    customerEmail: req.user.email,
                    serviceName: resolvedName,
                    appointmentDate: appointment.appointmentDate || "",
                },
                success_url: `${clientUrl}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${clientUrl}/dashboard/my-appointments?payment=cancelled`,
            });

            res.json({ url: session.url, sessionId: session.id });
        } catch (error) {
            console.error("Stripe checkout error:", error);
            res.status(500).json({
                message:
                    error.message || "Failed to create Stripe checkout session",
            });
        }
    }
);

app.all("/api/payments/verify-session", authMiddleware, async (req, res) => {
    try {
        const transactionsCollection = req.db.collection("transactions");
        const appointmentsCollection = req.db.collection("appointments");

        const session_id =
            req.query.session_id ||
            req.query.sessionId ||
            req.body?.session_id ||
            req.body?.sessionId;

        if (!session_id) {
            return res.status(400).json({ message: "Missing Stripe session ID" });
        }

        const existingTx = await transactionsCollection.findOne({
            stripeSessionId: session_id,
        });

        if (existingTx) {
            return res.json({
                verified: true,
                message: "Payment already verified",
                transaction: existingTx,
            });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== "paid") {
            return res
                .status(400)
                .json({ message: "Payment has not been completed yet" });
        }

        const appointmentId = session.metadata?.appointmentId;
        if (appointmentId && ObjectId.isValid(appointmentId)) {
            await appointmentsCollection.updateOne(
                { _id: new ObjectId(appointmentId) },
                {
                    $set: {
                        paymentStatus: "paid",
                        stripeSessionId: session.id,
                        updatedAt: new Date(),
                    },
                }
            );
        }

        const currentUserId = String(req.user._id || req.user.id);

        const transactionRecord = {
            appointmentId: appointmentId || "",
            userId: session.metadata?.userId || currentUserId,
            customerId: session.metadata?.userId || currentUserId,
            customerName: session.metadata?.customerName || req.user.name,
            customerEmail:
                session.metadata?.customerEmail ||
                session.customer_email ||
                req.user.email,
            serviceName: session.metadata?.serviceName || "Salon Service",
            appointmentDate: session.metadata?.appointmentDate || "",
            amount: (session.amount_total || 0) / 100,
            currency: (session.currency || "usd").toUpperCase(),
            stripeSessionId: session.id,
            transactionId:
                typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : session.id,
            paymentStatus: "paid",
            createdAt: new Date(),
        };

        const insertResult = await transactionsCollection.insertOne(
            transactionRecord
        );

        res.json({
            verified: true,
            message: "Payment verified and recorded!",
            transaction: { ...transactionRecord, _id: insertResult.insertedId },
        });
    } catch (error) {
        console.error("Stripe verification error:", error);
        res.status(500).json({
            message: error.message || "Failed to verify Stripe session",
        });
    }
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`TrimBook server running on port ${PORT}`);
    });
}

export default app;