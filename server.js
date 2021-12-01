require('dotenv').config()
const cookieParser = require('cookie-parser')
const cors = require('cors')
const router = require('./router/index')
const mongoose = require('mongoose')
const express = require('express')
const app = express()

const errorMiddleware = require('./middlewares/error-middleware');

app.use(cookieParser())
app.use(express.json())
app.use(cors({
    credentials: true,
    origin: [process.env.CLIENT_URL]
}));
app.use('/api', router)
app.use(errorMiddleware);

const start = async () => {
    try {
        await mongoose.connect(process.env.DB_URI, {
            useUnifiedTopology: true,
            useNewUrlParser: true
        })


        app.listen(process.env.PORT, () => console.log(`Server listen on port ${process.env.PORT}`))
    } catch (e) {
        console.log(e)
    }
}
start()

