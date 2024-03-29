const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ObjectID } = require('mongodb');
const { query } = require('express');
const admin = require("firebase-admin");
const port = process.env.PORT || 5000;
const ObjectId = require('mongodb').ObjectId;

//jwt verification
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



//middlewawire
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wymui.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
console.log(uri);

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        } catch (error) {

        }
    }
    next();
}

async function run() {
    try {
        await client.connect();
        const database = client.db('bikehub');
        const bikesCollection = database.collection('bikes');
        const usersCollection = database.collection('users');
        const orderCollection = database.collection('orders');
        const reviewCollection = database.collection('reviews');
        const socialCollection = database.collection('social')
        app.get('/bikes', async (req, res) => {
            const cursor = bikesCollection.find();
            const bikes = await cursor.toArray();
            res.json(bikes);
        })


        app.post('/bikes', async (req, res) => {
            const bikes = req.body;
            const result = await bikesCollection.insertOne(bikes);
            console.log(result);
            res.json(result);
        });

        app.delete('/bikes/:id', verifyToken, async(req, res) => {
            const id = req.params.id;
            console.log("delete",id);
            const query = {_id : ObjectId(id)};
            const result = await bikesCollection.deleteOne(query);
            res.json(result);
        })

        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            console.log(result);
            res.json(result);
        });

        app.get('/bikes/:_id', async (req, res) => {
            const _id = req.params._id;
            const query = { _id: ObjectId(_id) };
            const bike = await bikesCollection.findOne(query);
            res.json(bike);
        })


        app.get('/reviews', async (req, res) => {
            const cursor = reviewCollection.find();
            const reviews = await cursor.toArray();
            
            res.json(reviews);
        })

        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
           
            res.json(result);
        });
        app.get('/social', async (req, res) => {
            const cursor = socialCollection.find();
            const photos = await cursor.toArray();
            
            res.json(photos);
        })

        app.post('/social', async (req, res) => {
            const photo = req.body;
            const result = await socialCollection.insertOne(photo);
           
            res.json(result);
        });

        app.get('/orders', verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const cursor = orderCollection.find(query);
            const orders = await cursor.toArray();
            res.json(orders);
        })

        //delete using auto generated unique order id. customer cant see orders from emails, meaning has no access to oderId that was not created by the email.
        app.delete('/orders', verifyToken, async(req, res) => {
            const id = req.body;
            console.log("delete",id);
            const query = {orderId : id.orderId};
            const result = await orderCollection.deleteOne(query);
            res.json(result);
        })

        app.get('/orders/admin', verifyToken, async (req, res) => {
            const cursor = orderCollection.find();
            const orders = await cursor.toArray();
            res.json(orders);
        })
        app.put('/orders/admin', verifyToken, async (req, res) => {
            const orderId = req.body;
            
            console.log(orderId);
            const filter = { orderId: orderId.orderId };
            const updateDoc = { $set: { status: 'shipped' } };
            const result = await orderCollection.updateOne(filter, updateDoc);
            res.json(result);
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })
        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        })

        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            console.log('put', user);
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        })

        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'Permission denied' });
            }
        })

    } finally {
        //await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Bike Market is Live')
})

app.listen(port, () => {
    console.log(`listening at ${port}`)
})