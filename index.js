import express from "express";
import "dotenv/config";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import { createVerifyToken } from "./middlewares/verifyToken.js";

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
                        message: "This time slot is already booked for the selected date. Please choose another slot.",
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

        app.listen(PORT, () => {
            console.log(`TrimBook server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to connect to MongoDB:", err);
    }
}

startServer();