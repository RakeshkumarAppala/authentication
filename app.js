const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

//Authentication
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeaders = request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "my_secret_token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//User Login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectQuery = `select * from user where username = '${username}';`;
  const dbUser = await db.get(selectQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === false) {
      response.status(400);
      response.send("Invalid Password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "my_secret_token");
      response.send(jwtToken);
    }
  }
});

//All States in the table
app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesQuery = `select * from state;`;
  const states = await db.all(getAllStatesQuery);
  response.send(states);
});

//State based on the state ID
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `select * from state where state_id = ${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(state);
});

//Creating District
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
        insert into district(district_name,state_id,cases,cured,active,deaths)
        values ('${districtName}',
                ${stateId},
                ${cases},
                ${cured},
                ${active},
                ${deaths}
            );
    `;
  const postDistrict = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//Get District
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `select * from district where district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    response.send(district);
  }
);

// Delete District
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistQuery = `delete from district where district_id = ${districtId};`;
    await db.run(deleteDistQuery);
    response.send("District Removed");
  }
);

//Update District
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistQuery = `
    update district
    set district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    where district_id = ${districtId};
    `;
    await db.run(updateDistQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `select sum(cases) as totalCases,
                          sum(cured) as totalCured,
                          sum(active) as totalActive,
                          sum(deaths) as totalDeaths
                    from district
                    where state_id = ${stateId};
    `;
    const stats = await db.get(statsQuery);
    response.send(stats);
  }
);
