"use strict";

const uuid = require("uuid");
const AWS = require("aws-sdk");
const nodemailer = require("nodemailer");

const dynamoDB = new AWS.DynamoDB.DocumentClient({
  accessKeyId: "xxxx",
  secretAccessKey: "xxxx",
  region: "localhost",
  endpoint: "http://localhost:8000 ",
}); //remove when deployoing

// create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // upgrade later with STARTTLS
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
    tls: {
      rejectUnauthorized: true,
    },
});

module.exports.authenticate = async (event, context,callback)=>{
  console.log('inside middleware');
  // context.end();
  callback(null, {
    statusCode: 200,
    body: JSON.stringify('Middleware', null, 2),
  });
}

module.exports.create = async (event, context, callback) => {
  try {
    const { name, email } = JSON.parse(event.body);
    console.log(" body==> ", name, email);
    const params = {
      TableName: process.env.DYNAMODB_TABLE,
      Item: {
        id: uuid.v1(),
        username: name,
        email,
      },
    };
    const result = await dynamoDB.put(params).promise();
    let info = await transporter.sendMail({
      to: email, // list of receivers
      from: '"Welcome" <hitboxing20@gmail.com>', // sender address
      subject: 'You are registered to serverless', // Subject line
      html: `<p>Hi, Welcome to Serverless</p>`, // HTML body content
    });
    console.log("result", result);
    console.log("Message sent:", info);
    let res = {
      message: "User Created",
    };
    return {
      statusCode: 200,
      body: JSON.stringify(res, null, 2),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 400,
      body: JSON.stringify(error.message, null, 2),
    };
  }
};

module.exports.getAll = async (event, context, callback) => {
  let params = {
    TableName: process.env.DYNAMODB_TABLE,
  };
  try {
    const result = await dynamoDB.scan(params).promise();
    console.log(result);

    callback(null, {
      statusCode: 200,
      body: JSON.stringify(result.Items, null, 2),
    });
  } catch (error) {
    console.error(error);
    handleError(error, " Fail to fetch users", callback);
  }
};

module.exports.getOne = async (event, context, callback) => {
  const { id } = event.pathParameters;
  console.log(event.pathParameters);
  let params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      id,
    },
  };
  try {
    const result = await dynamoDB.get(params).promise();
    console.log("result=>", result);
    if (result.Item) {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify(result.Item),
      });
    } else {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({ message: "No user found of id " + id }),
      });
    }
  } catch (error) {
    console.error(error);
    handleError(error, " Fail to fetch users", callback);
  }
};

module.exports.update = async (event, context, callback) => {
  const body = JSON.parse(event.body);
  const { id } = event.pathParameters;
  let params = {
    TableName: process.env.DYNAMODB_TABLE, // table name
  };
  params["Key"] = {
    id,
  };
 
  try {
    const found = await dynamoDB.get(params).promise();
    console.log("found=>", found);
    if (found.Item){
      params["ExpressionAttributeValues"] = {
        ":username": body.name,
        ":email": body.email,
      };
      params["UpdateExpression"] = "SET username = :username, email = :email";
      params["ReturnValues"] = "ALL_NEW";
      const result = await dynamoDB.update(params).promise();
      console.log("result==>", result);
      const response = {
        statusCode: 200,
        body: JSON.stringify(result.Attributes),
      };
      callback(null, response);
    }
    else{
      callback(null, {
        statusCode: 400,
        body: JSON.stringify({
          message :"No user found with id : "+id
        }),
      });
    }
  } catch (error) {
    console.log("error", error);
    handleError(error, "Failed to Update the User", callback);
  }
};

module.exports.delete = async (event, context, callback) => {
  const { id } = event.pathParameters;
  const params = {
    TableName: process.env.DYNAMODB_TABLE, // table name
    Key: {
      id,
    },
  };
  try {
    const result = await dynamoDB.delete(params).promise();
    console.log("result", result);
    if (result === {}) {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          message: `User ${id} removed from DB`,
        }),
      });
    } else {
      callback(null, {
        statusCode: 400,
        body: JSON.stringify({
          message: `User ${id} not found !`,
        }),
      });
    }
  } catch (error) {
    handleError(error, "Failed to Delete the User", callback);
  }
};

// Handler that handles the error, occured during insert, read, update, delete
const handleError = (error, errorMsg, callback) => {
  console.error(error);
  return callback(null, {
    statusCode: error.statusCode || 500,
    headers: { "Content-Type": "text/plain" },
    body: errorMsg,
  });
};
