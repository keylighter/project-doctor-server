const express = require('express');
const admin = require("firebase-admin");
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient } = require('mongodb');

const port = process.env.PORT || 5000;

//firebase admin
//filename-   node-doctor-firebase-adminsdk.json




const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


//cors and express json for getting access and connection with and from client side
app.use(cors());
//to get user data access easily 
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.u7kce.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


//f. admin 
async function verifyToken(req, res, next) {

    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];
        //(slightly modified from this doc)  https://firebase.google.com/docs/auth/admin/verify-id-tokens?authuser=0   
        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}

async function run() {
    try {
        await client.connect();
        const database = client.db('doctors_portal');
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');
        app.get('/appointments', async (req, res) => {
            const email = req.query.email;
            const date = (req.query.date)
            // console.log(date);
            const query = { email: email, date: date }
            const cursor = appointmentsCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        })

        app.post('/appointments', verifyToken, async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment);
            console.log(result);
            res.json(result)
        });

        //admin getting 
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
            console.log(req.body);
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        })


        //upsert
        // https://docs.mongodb.com/drivers/node/current/usage-examples/updateOne/

        app.put('/users', async (req, res) => {
            const user = req.body;
            //filter and query are almost same
            // filter email - because it is an unique identifier .

            const filter = { email: user.email };


            // this option instructs the method to **create a document** **if no documents match the filter**
            const options = { upsert: true };


            // create a document that sets the user
            const updateDoc = {
                $set: user
            };

            const result = await usersCollection.updateOne(filter, updateDoc, options);

            res.json(result);

        });

        //after users/admin > process verifyToken >> then (req,res)
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = usersCollection.findOne({ email: requester });
                if (requester.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to the admin pannel' });
            }


        })

    }
    finally {
        //await client.close();
    }
}

run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('Hello Doctors!')
})

app.listen(port, () => {
    console.log(`Example app listening at ${port}`)
})