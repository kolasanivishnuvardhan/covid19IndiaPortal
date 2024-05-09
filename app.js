const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const path = require('path')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())

//initialize db and server
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server started!!')
    })
  } catch (e) {
    console.log(`ERROR : ${e.message}`)
  }
}
initializeDbAndServer() // initialization completed

// authenticate token
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
    if (jwtToken === undefined) {
      response.status(401)
      response.send('Invalid JWT Token')
    } else {
      jwt.verify(jwtToken, 'MY_SECRET_TOKEN', (error, payload) => {
        if (error) {
          response.status(401)
          response.send('Invalid JWT Token')
        } else {
          request.username = payload.username
          next()
        }
      })
    }
  }else{
    response.status(401)
    response.send("Invalid JWT Token")
  }
}

//Register user
app.post('/register', async (request, response) => {
  const {username, name, password, gender, location} = request.body
  const hashedPassword = await bcrypt.hash(password, 10)
  const addUserQuery = `
    insert into user(username, name,password,gender,location)
    values('${username}','${name}','${hashedPassword}','${gender}','${location}');
    `
  if (password.length < 5) {
    response.status(400)
    response.send('Password too short')
  } else {
    await db.run(addUserQuery)
    response.send('User created successfully')
  }
})

// Login
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getUserQuery = `
  select
    *
  from
    user
  where
    username = '${username}';
  `
  const user = await db.get(getUserQuery)
  if (user) {
    const verifyPassword = await bcrypt.compare(password, user.password)
    if (verifyPassword) {
      const payload = {
        username: username,
      }
      // login success create jwt token
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    response.status(400)
    response.send('Invalid user')
  }
})

// api 2 get states
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `
  select
    state_id as stateId,
    state_name as stateName,
    population
  from
    state;
  `
  const statesArray = await db.all(getStatesQuery)
  response.send(statesArray)
}) // api 2 completed

// api 3 return state based on stateId
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
  select
    state_id as stateId,
    state_name as stateName,
    population    
  from
    state
  where
    state_id = ${stateId};
  `
  const stateDetails = await db.get(getStateQuery)
  response.send(stateDetails)
}) //api 3 completed

// api 4 create a district in the district table where district id is auto incrmented
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const addDistrictQuery = `
  insert into district(district_name, state_id, cases, cured, active, deaths)
  values('${districtName}',${stateId},${cases},${cured},${active},${deaths});
  `
  await db.run(addDistrictQuery)
  response.send('District Successfully Added')
}) // api 4 completed

// api 5 Returns a district based on the district ID
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `
  select
    district_id as districtId,
    district_name as districtName,
    state_id as stateId,
    cases,
    cured,
    active, 
    deaths
  from
    district
  where
    district_id = ${districtId};
  `
    const district = await db.get(getDistrictQuery)
    response.send(district)
  },
) //api 5 completed

// api 6 Deletes a district from the district table based on the district ID
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
  delete from district
    where
      district_id = ${districtId};
  `
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
) //api 6 completed

// api 7 Updates the details of a specific district based on the district ID
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictQuery = `
  update district set
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
  where
    district_id = ${districtId};
  `
    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
) // api 7 completed

// api 8 Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatisticsOfstateQuery = `
  select
    sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths
  from
    state as s inner join district as d on s.state_id = d.state_id
  where
    s.state_id = ${stateId};
  `
    const getStatistics = await db.get(getStatisticsOfstateQuery)
    response.send(getStatistics)
  },
)
module.exports = app
