import express from 'express';
import 'dotenv/config'
import cors from 'cors';
import { MongoClient } from 'mongodb';

const app = express();
const PORT = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());

const client = new MongoClient(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.wsx0u5m.mongodb.net/`);

export async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("You successfully connected to MongoDB!");
        return client;
    } catch (err) {
        console.dir(err);
    }
}

const connectedClient = await connectToMongoDB();

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}`)
})