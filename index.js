import express from "express";
import "dotenv/config";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import { createVerifyToken } from "./middlewares/verifyToken.js";
import { verifyAdmin } from "./middlewares/verifyAdmin.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        credentials: true,
    })
);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.wsx0u5m.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

async function startServer() {
    try {
        await client.connect();
        console.log("Successfully connected to MongoDB!");

        const db = client.db("trimbook");
        const servicesCollection = db.collection("services");
        const appointmentsCollection = db.collection("appointments");

        const verifyToken = createVerifyToken(db);

        app.get("/", (req, res) => {
            res.send("TrimBook API Server is running!");
        });

        app.get("/api/auth/me", verifyToken, (req, res) => {
            res.json({
                _id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                image: req.user.image,
                role: req.user.role,
                isBlocked: req.user.isBlocked,
                phone: req.user.phone || "",
            });
        });

        app.patch("/api/users/profile", verifyToken, async (req, res) => {
            try {
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
                    updateFields.image = image.trim();
                }

                await db
                    .collection("user")
                    .updateOne({ _id: req.user._id }, { $set: updateFields });

                const updatedUser = await db
                    .collection("user")
                    .findOne({ _id: req.user._id });

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
                res.status(500).json({ message: "Failed to update profile" });
            }
        });

        app.get("/api/services", async (req, res) => {
            try {
                const { search, category, sort, all } = req.query;
                const query = {};

                if (all !== "true") {
                    query.status = "active";
                }

                if (category && category !== "All") {
                    query.category = category;
                }

                if (search) {
                    query.serviceName = { $regex: search, $options: "i" };
                }

                let sortOption = { createdAt: -1 };
                if (sort === "price_asc") sortOption = { price: 1 };
                if (sort === "price_desc") sortOption = { price: -1 };

                const services = await servicesCollection
                    .find(query)
                    .sort(sortOption)
                    .toArray();

                res.json(services);
            } catch (error) {
                res.status(500).json({ message: "Failed to fetch services" });
            }
        });

        app.get("/api/services/:id", async (req, res) => {
            try {
                const { id } = req.params;
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: "Invalid service ID" });
                }

                const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
                if (!service) {
                    return res.status(404).json({ message: "Service not found" });
                }

                res.json(service);
            } catch (error) {
                res.status(500).json({ message: "Failed to load service details" });
            }
        });

        app.post("/api/services", verifyToken, verifyAdmin, async (req, res) => {
            try {
                const {
                    serviceName,
                    category,
                    description,
                    price,
                    duration,
                    image,
                    status,
                } = req.body;

                if (!serviceName || !serviceName.trim()) {
                    return res.status(400).json({ message: "Service name is required" });
                }
                if (!category || !category.trim()) {
                    return res.status(400).json({ message: "Service category is required" });
                }
                if (!description || !description.trim()) {
                    return res.status(400).json({ message: "Description is required" });
                }
                if (!image || !image.trim()) {
                    return res.status(400).json({ message: "Service image is required" });
                }

                const numericPrice = Number(price);
                const numericDuration = Number(duration);

                if (isNaN(numericPrice) || numericPrice <= 0) {
                    return res.status(400).json({ message: "Price must be a positive number" });
                }
                if (isNaN(numericDuration) || numericDuration <= 0) {
                    return res.status(400).json({ message: "Duration must be a positive number" });
                }

                const validStatus = status === "inactive" ? "inactive" : "active";

                const newService = {
                    serviceName: serviceName.trim(),
                    category: category.trim(),
                    description: description.trim(),
                    price: numericPrice,
                    duration: numericDuration,
                    image: image.trim(),
                    status: validStatus,
                    createdBy: req.user._id,
                    createdAt: new Date(),
                };

                const result = await servicesCollection.insertOne(newService);

                res.status(201).json({
                    message: "Salon service created successfully!",
                    serviceId: result.insertedId,
                });
            } catch (error) {
                res.status(500).json({ message: "Failed to create service" });
            }
        });

        app.patch("/api/services/:id", verifyToken, verifyAdmin, async (req, res) => {
            try {
                const { id } = req.params;
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: "Invalid service ID" });
                }

                const {
                    serviceName,
                    category,
                    description,
                    price,
                    duration,
                    image,
                    status,
                } = req.body;

                if (!serviceName || !serviceName.trim()) {
                    return res.status(400).json({ message: "Service name is required" });
                }
                if (!category || !category.trim()) {
                    return res.status(400).json({ message: "Service category is required" });
                }
                if (!description || !description.trim()) {
                    return res.status(400).json({ message: "Description is required" });
                }

                const numericPrice = Number(price);
                const numericDuration = Number(duration);

                if (isNaN(numericPrice) || numericPrice <= 0) {
                    return res.status(400).json({ message: "Price must be a positive number" });
                }
                if (isNaN(numericDuration) || numericDuration <= 0) {
                    return res.status(400).json({ message: "Duration must be a positive number" });
                }

                const updateDoc = {
                    serviceName: serviceName.trim(),
                    category: category.trim(),
                    description: description.trim(),
                    price: numericPrice,
                    duration: numericDuration,
                    status: status === "inactive" ? "inactive" : "active",
                    updatedAt: new Date(),
                };

                if (image && image.trim()) {
                    updateDoc.image = image.trim();
                }

                const result = await servicesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateDoc }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: "Service not found" });
                }

                res.json({ message: "Service updated successfully!" });
            } catch (error) {
                res.status(500).json({ message: "Failed to update service" });
            }
        });

        app.patch("/api/services/:id/status", verifyToken, verifyAdmin, async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: "Invalid service ID" });
                }

                if (status !== "active" && status !== "inactive") {
                    return res.status(400).json({ message: "Status must be active or inactive" });
                }

                const result = await servicesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status, updatedAt: new Date() } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: "Service not found" });
                }

                res.json({ message: `Service marked as ${status}` });
            } catch (error) {
                res.status(500).json({ message: "Failed to update service status" });
            }
        });

        app.delete("/api/services/:id", verifyToken, verifyAdmin, async (req, res) => {
            try {
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

                res.json({ message: "Service deleted successfully" });
            } catch (error) {
                res.status(500).json({ message: "Failed to delete service" });
            }
        });

        app.post("/api/appointments", verifyToken, async (req, res) => {
            try {
                if (req.user.role === "admin") {
                    return res.status(403).json({
                        message: "Admins cannot submit customer appointment requests",
                    });
                }

                const { serviceId, appointmentDate, timeSlot, message } = req.body;

                if (!serviceId || !ObjectId.isValid(serviceId)) {
                    return res.status(400).json({ message: "Invalid service ID" });
                }

                if (!appointmentDate || !timeSlot) {
                    return res.status(400).json({
                        message: "Appointment date and time slot are required",
                    });
                }

                const service = await servicesCollection.findOne({
                    _id: new ObjectId(serviceId),
                });

                if (!service) {
                    return res.status(404).json({ message: "Service not found" });
                }

                if (service.status !== "active") {
                    return res.status(400).json({
                        message: "This service is currently inactive and unavailable for booking",
                    });
                }

                const existingConflict = await appointmentsCollection.findOne({
                    serviceId: new ObjectId(serviceId),
                    appointmentDate,
                    timeSlot,
                    status: { $in: ["pending", "confirmed"] },
                });

                if (existingConflict) {
                    return res.status(409).json({
                        message:
                            "This time slot is already booked for the selected date. Please choose another slot.",
                    });
                }

                const newAppointment = {
                    serviceId: new ObjectId(serviceId),
                    customerId: req.user._id,
                    appointmentDate,
                    timeSlot,
                    message: message?.trim() || "",
                    servicePrice: Number(service.price),
                    paymentStatus: "unpaid",
                    status: "pending",
                    createdAt: new Date(),
                };

                const result = await appointmentsCollection.insertOne(newAppointment);

                res.status(201).json({
                    message: "Appointment request submitted successfully!",
                    appointmentId: result.insertedId,
                });
            } catch (error) {
                res.status(500).json({ message: "Failed to submit appointment request" });
            }
        });

        app.get("/api/dashboard/stats", verifyToken, async (req, res) => {
            try {
                if (req.user.role === "admin") {
                    const [
                        totalCustomers,
                        activeServices,
                        totalAppointments,
                        pendingAppointments,
                        confirmedAppointments,
                        paidTransactions,
                    ] = await Promise.all([
                        db.collection("user").countDocuments({ role: "customer" }),
                        servicesCollection.countDocuments({ status: "active" }),
                        appointmentsCollection.countDocuments(),
                        appointmentsCollection.countDocuments({ status: "pending" }),
                        appointmentsCollection.countDocuments({ status: "confirmed" }),
                        db.collection("transactions").find({ paymentStatus: "paid" }).toArray(),
                    ]);

                    const totalRevenue = paidTransactions.reduce(
                        (sum, tx) => sum + (Number(tx.amount) || 0),
                        0
                    );

                    return res.json({
                        role: "admin",
                        totalCustomers,
                        activeServices,
                        totalAppointments,
                        pendingAppointments,
                        confirmedAppointments,
                        totalRevenue,
                        successfulPaymentsCount: paidTransactions.length,
                    });
                }

                const customerId = req.user._id;
                const [totalRequests, pendingCount, confirmedCount, cancelledCount] =
                    await Promise.all([
                        appointmentsCollection.countDocuments({ customerId }),
                        appointmentsCollection.countDocuments({ customerId, status: "pending" }),
                        appointmentsCollection.countDocuments({ customerId, status: "confirmed" }),
                        appointmentsCollection.countDocuments({ customerId, status: "cancelled" }),
                    ]);

                res.json({
                    role: "customer",
                    totalRequests,
                    pendingCount,
                    confirmedCount,
                    cancelledCount,
                });
            } catch (error) {
                res.status(500).json({ message: "Failed to load dashboard statistics" });
            }
        });

        app.get("/api/appointments/my", verifyToken, async (req, res) => {
            try {
                if (req.user.role === "admin") {
                    return res.status(403).json({
                        message: "Forbidden: Customers only",
                    });
                }

                const appointments = await appointmentsCollection
                    .aggregate([
                        { $match: { customerId: req.user._id } },
                        { $sort: { createdAt: -1 } },
                        {
                            $lookup: {
                                from: "services",
                                localField: "serviceId",
                                foreignField: "_id",
                                as: "serviceInfo",
                            },
                        },
                        {
                            $unwind: {
                                path: "$serviceInfo",
                                preserveNullAndEmptyArrays: true,
                            },
                        },
                        {
                            $lookup: {
                                from: "transactions",
                                localField: "_id",
                                foreignField: "appointmentId",
                                as: "transactionInfo",
                            },
                        },
                        {
                            $unwind: {
                                path: "$transactionInfo",
                                preserveNullAndEmptyArrays: true,
                            },
                        },
                    ])
                    .toArray();

                res.json(appointments);
            } catch (error) {
                res.status(500).json({ message: "Failed to load your appointments" });
            }
        });

        app.patch("/api/appointments/:id/cancel", verifyToken, async (req, res) => {
            try {
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

                if (String(appointment.customerId) !== String(req.user._id)) {
                    return res.status(403).json({
                        message: "Unauthorized: You can only cancel your own appointments",
                    });
                }

                if (appointment.status !== "pending") {
                    return res.status(400).json({
                        message: `Cannot cancel an appointment that is already ${appointment.status}`,
                    });
                }

                await appointmentsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status: "cancelled",
                            updatedAt: new Date(),
                        },
                    }
                );

                res.json({ message: "Appointment request cancelled successfully" });
            } catch (error) {
                res.status(500).json({ message: "Failed to cancel appointment" });
            }
        });

        app.listen(PORT, () => {
            console.log(`TrimBook server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to connect to MongoDB:", err);
    }
}

startServer();