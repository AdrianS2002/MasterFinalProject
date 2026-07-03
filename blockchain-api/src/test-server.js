const express = require('express');
const app = express();

app.use(express.json());

app.post('/test', (req, res) => {
    if (!req.body.username || !req.body.password) {
        return res.status(400).send({ error: "Missing username or password" });
    }
    console.log("Body received: ", req.body);
    res.json({ received: req.body });
});

app.listen(4000, () => console.log("✅ Test server running on port 4000"));
