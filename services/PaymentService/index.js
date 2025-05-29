const express = require("express");
const app = express();
const paymentRoutes = require("./routes/paymentRoutes"); // import routes booking
const cors = require("cors");
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/payments", paymentRoutes);

// Lắng nghe server trên PORT
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`PaymentService is running on port ${PORT}`);
});

// const express = require("express");
// const dotenv = require("dotenv");
// const cors = require("cors");
// const PayOS = require("@payos/node");

// const app = express();
// dotenv.config();
// const payOS = new PayOS(
//   process.env.PAYOS_CLIENT_ID,
//   process.env.PAYOS_API_KEY,
//   process.env.PAYOS_CHECKSUM_KEY
// );

// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));

// app.post("/create-embedded-payment-link", async (req, res) => {
//   const YOUR_DOMAIN = `http://localhost:3000/`;
//   const body = {
//     orderCode: Number(String(Date.now()).slice(-6)),
//     amount: 10000,
//     description: "Thanh toan don hang",
//     items: [
//       {
//         name: "Mì tôm Hảo Hảo ly",
//         quantity: 1,
//         price: 10000,
//       },
//     ],
//     returnUrl: `${YOUR_DOMAIN}`,
//     cancelUrl: `${YOUR_DOMAIN}`,
//   };

//   try {
//     const paymentLinkResponse = await payOS.createPaymentLink(body);

//     res.send(paymentLinkResponse);
//   } catch (error) {
//     console.error(error);
//     res.send("Something went error");
//   }
// });

// const PORT = process.env.PORT || 5005;
// app.listen(PORT, () => {
//   console.log(`PaymentService server running on port ${PORT}`);
// });
