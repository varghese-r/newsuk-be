const express = require("express");
const app = express();
const stripe = require("stripe")(
  "sk_test_51Jw3UpHciXopN8Ipcui9599OVN7aq5j3nfSOuduYTjYalOAZ5Fo3DENEAL2iPheVx9mnDm12LvZPim6lWuzm71FA00aJpcXFRi"
);

app.use(express.static("public"));
app.use(express.json());

app.use(function (req, res, next) {
  //Enabling CORS
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, x-client-key, x-client-token, x-client-secret, Authorization"
  );
  next();
});

app.get("/", async (req, res) => {
  res.send("<h2>This works!!</h2>");
});

app.get("/products", async (req, res) => {
  const product_arr = [
    "prod_Mg8w0uVouePEBg",
    "prod_Mg9ErZsu5Enj30",
    "prod_Mgs46459BaC4AH",
    "prod_Mg9LJjFawZQVAd",
  ];

  let prod_data = [];
  for (let i = 0; i < product_arr.length; i++) {
    const product = await stripe.products.retrieve(product_arr[i]);

    prod_data.push({
      name: product.name,
      prod_id: product.id,
      price_id: product.default_price,
      description: product.description,
      metadata: product.metadata,
    });
  }
  res.send(prod_data);
});

app.post("/customer", async (req, res) => {
  const { name, email } = { ...req.body };

  const timeNow = new Date();
  const timeTransformed =
    timeNow.toDateString() + " " + timeNow.toLocaleTimeString().substring(0, 5);

  const testClock = await stripe.testHelpers.testClocks.create({
    frozen_time: new Date(timeTransformed).getTime() / 1000,
  });

  const customer = await stripe.customers.create({
    name,
    email,
    test_clock: testClock.id,
  });

  res.send({ name: customer.name, email: customer.email, id: customer.id });
});

app.post("/product", async (req, res) => {
  const { product, user, payment_method } = { ...req.body };

  const retrievedProduct = await stripe.products.retrieve(product.prod);

  console.log("inside product in backend");

  let setupIntent = "";
  if (payment_method === "") {
    setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
      customer: user.id,
    });
  } else {
    res.send({
      product: retrievedProduct,
    });
  }

  res.send({
    product: retrievedProduct,
    client_secret: setupIntent.client_secret,
  });
  console.log("From backend- ", setupIntent.client_secret);
});

app.post("/create_subscription", async (req, res) => {
  const { user, price_id, payment_method } = req.body;

  console.log(user, price_id, payment_method);

  // const paymentMethod = await stripe.paymentMethods.attach(payment_method, {
  //   customer: user.id,
  // });

  // // console.log(paymentMethod);

  // const customer = await stripe.customers.retrieve(user.id);

  // console.log(customer);

  const price = await stripe.prices.retrieve(price_id);

  let items = [];
  if (price.recurring.usage_type === "metered") {
    items = [{ price: price_id }];
  } else {
    items = [{ price: price_id, quantity: 1 }];
  }
  const subscription = await stripe.subscriptions.create({
    customer: user.id,
    items: items,
    default_payment_method: payment_method,
    collection_method: "charge_automatically",
  });

  console.log("Subscription from backend- ", subscription);

  res.send(subscription);
});

app.post("/get_subscription", async (req, res) => {
  const subscriptions = await stripe.subscriptions.list({
    customer: req.body.customer,
    status: "active",
    expand: ["data.latest_invoice"],
  });

  console.log(subscriptions);
  res.send(subscriptions);
});

app.post("/get_product", async (req, res) => {
  const { productId } = { ...req.body };

  const product = await stripe.products.retrieve(productId);

  res.send(product);
});

app.post("/pause_subscription", async (req, res) => {
  const { dateObject, customer, subscriptionId } = { ...req.body };

  const monthArr = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const timeNow = new Date();
  const timeTransformed = `${monthArr[+dateObject.month - 1]} ${
    dateObject.day
  } ${dateObject.year} ${timeNow.toLocaleTimeString().substring(0, 5)}`;

  // new Date(timeTransformed).getTime() / 1000,
  console.log(timeTransformed, customer, subscriptionId);

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    pause_collection: {
      behavior: "void",
      resumes_at: new Date(timeTransformed).getTime() / 1000,
    },
    // billing_cycle_anchor: new Date(timeTransformed).getTime() / 1000,
  });

  console.log(subscription);
  res.send(subscription);
});

app.post("/cancel_check", async (req, res) => {
  const { customer: customerId } = { ...req.body };

  const customer = await stripe.customers.retrieve(customerId);

  res.send(customer);
});

app.post("/confirm_discount", async (req, res) => {
  const { subscriptionId, priceId } = { ...req.body };

  const subscriptionSchedule = await stripe.subscriptionSchedules.create({
    from_subscription: subscriptionId,
  });

  const updateSubscriptionSchedule = await stripe.subscriptionSchedules.update(
    subscriptionSchedule.id,
    {
      phases: [
        {
          start_date: subscriptionSchedule.phases[0].start_date, //new Date("Oct 26 2023 17:23").getTime() / 1000,
          items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          iterations: 4,
          coupon: "qYm6r44p",
        },
        {
          items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          iterations: 1,
        },
      ],
      end_behavior: "release",
    }
  );

  const customer = await stripe.customers.update(
    updateSubscriptionSchedule.customer,
    {
      metadata: { discount_availed: "true" },
    }
  );

  console.log(updateSubscriptionSchedule);
  res.send(updateSubscriptionSchedule);

  console.log(subscriptionId, priceId);
});

app.post("/confirm_cancel", async (req, res) => {
  const { subscriptionId } = { ...req.body };

  console.log(subscriptionId);

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });

  res.send(subscription);
});

app.listen(4242, () => {
  console.log("Node server listening on port 4242!!");
});
