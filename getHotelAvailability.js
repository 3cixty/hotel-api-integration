// This script retrieves the list of available hotels in a certain city, defined by the value of variable "city_ids".
// The data is stored in a mongoDB DB, and also locally, in a set of text files, just for logging purposes.

// To Run the script (dependencies):
// - you need a MongoDB installation on the machine on which you run the script. The MongoDB should be on the standard port (27017).
// - you need to be able to run nodejs (https://nodejs.org/en/) scripts on your machine
// - you need certain nodejs modules (you can install them locally in the folder from which you launch the script), and more precisely: fs, sleep, bunyan, request, mongodb, assert
//   to install these modules you can simply use the npm utility (https://www.npmjs.com/)
//
// To launch the script you just need to invoke
// nodejs getHotelAvailability.js


Date.prototype.formatYYYYMMDD = function(){
	return   this.getFullYear() +
		"-" +('0'+ (this.getMonth() + 1)).slice(-2) +
		"-" +  this.getDate() ;
}
Date.prototype.formatYYYYMMDDmmss = function(){
	return   this.getFullYear() +
		"_" + (this.getMonth() + 1) +
		"_" +  this.getDate() +
		"@" + this.getHours() +
		"_" + this.getMinutes();
	"_" + this.getSeconds();
}

Date.prototype.formatYYYYMMDDHHMMSS = function(){
   var hour = this.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = this.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = this.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = this.getFullYear();

    var month = this.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = this.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + "-" + month + "-" + day + "T" + hour + ":" + min + ":" + sec;

}

Date.prototype.formatMMDDYYYY = function(){
	return  (this.getMonth() + 1)  +
		"/" +  this.getDate() +
		"/" +  this.getFullYear();
}


//Helper functions, to compute the desired set of days
function getDaysInMonth(month, year) {
	var date = new Date(year, month, 1);
	var days = [];
	while (date.getMonth() === month) {
		days.push(new Date(date));
		date.setDate(date.getDate() + 1);
	}
	return days;
}


//Function to compute days from now till the end of month endMonth
function getDaysInMonthUntil(endMonth, year) {
	var date = new Date();
	var days = [];
	console.log(" date "+date.getYear()+" - "+date.getMonth());
	while (date.getMonth() != endMonth) {
		console.log(" date "+date);
		days.push(new Date(date));
		date.setDate(date.getDate() + 1);

	}
	//add the first day of the next month
	console.log(" date "+date);
	days.push(new Date(date));

	return days;
}

//Function to compute days from now till the end of month endMonth
function getDaysInMonthUntil(endMonth, year) {
	var date = new Date();
	var days = [];
	console.log(" date "+date.getYear()+" - "+date.getMonth());
	while (date.getMonth() != endMonth) {
		console.log(" date "+date);
		days.push(new Date(date));
		date.setDate(date.getDate() + 1);

	}
	//add the first day of the next month
	console.log(" date "+date);
	days.push(new Date(date));

	return days;
}


//Function to compute next X days (incuding current one)
function getNextXDays(ndays) {
	var date = new Date();
	var days = [];
	console.log(" date "+date.getYear()+" - "+date.getMonth());
	for (var j = 0 ; j <= ndays ; j++){
		console.log(" date "+date);
		days.push(new Date(date));
		date.setDate(date.getDate() + 1);

	}

	return days;
}


//Function to check if response from API is empty
function isEmpty(obj) {
	// null and undefined are "empty"
	if (obj == null) return true;

	// Assume if it has a length property with a non-zero value
	// that that property is correct.
	if (obj.length && obj.length > 0)    return false;
	if (obj.length === 0)  return true;

	// Otherwise, does it have any properties of its own?
	for (var key in obj) {
		if (hasOwnProperty.call(obj, key)) return false;
	}

	return true;
}

//API authentication credentials
var username = "3cixty"
var password = "98564Gofor"

//modules that need to be installed
var fs    = require('fs');
var sleep = require('sleep');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: 'BookingScrapper'});
var request = require('request');
var result=null;
var SLEEP_BETWEEN_QUERY = 3;


//BEGIN INITIALIZATION

//here we set what city we are interested in
var city = "Milan";
//this is the id for the city of Milan
var city_ids = "-121726";
var countrycodes = "it";


//initialize the number of rows to return for each call
var rows = 1000;
var offset = 0;
var languagecodes = "it";
var hotelList = [];
var pathBase = 'https://' + username + ":" + password + '@' + 'distribution-xml.booking.com' + '/json/bookings.getHotels?' + 'rows='+ rows + '&languagecodes=' + languagecodes; 

//set to a default value, changed when calling innercallback
var requestParam = "&city_ids=" + city_ids + "&countrycodes=" + countrycodes;

//fileName is the name of the file saved in the operating system, for debugging issues; the name is reset every time the data for a new day is retrieved.
var fileName= __dirname+"/" + city + "_Hotel_"+ languagecodes +"_"+(new Date()).formatYYYYMMDDmmss()+".json"

//using mongodb nodejs module to connect to mongodb, it seems to work better than mongojs
var MongoClient = require('mongodb').MongoClient, assert = require('assert');
// Connection URL
var mongodburl = 'mongodb://localhost:27017/roomsAvailability';
var BOOKINGdb = null;
var collection = null;
//we use the name of the city in the collection name
var collectionName = "availableHotelsRetrieved" + city;
//END INITIALIZATION


//connect to db and delete old collections
MongoClient.connect(mongodburl, function(err, db) {
		assert.equal(null, err);
		console.log("Connected correctly to server");
		BOOKINGdb = db;
		collection = BOOKINGdb.collection(collectionName);
		collections = BOOKINGdb.listCollections({name:{'$regex' : 'availableHotelsRetrievedMilan', '$options' : 'i'}}).toArray(function(err, collections) {
                        console.log("These are the collections available "+ collections.length );
                        for(var i = 0, len = collections.length; i < len ; i++){
                        var oldCollection = collections[i];
                        //console.log(oldCollection.name);
                        //console.log(typeof oldCollection.name);
                        BOOKINGdb.collection(oldCollection.name.toString()).drop(function(err, response) {
                        //console.log(response);
                        });     
                        }

                });

		});


var count = 0;
console.log ("path: "+pathBase);


//Function to call booking API, save data in file and mongodb. Saving done only once.

innerCallback = function(error, response, body) {
	console.log("Innercallback");
	if (error){
		console.log( error.codice );
		console.log( error.descrizione );
	}
	if (response){
		//console.log( response.request.uri.href);
		console.log( "Request status: " + response.statusCode );
	}
	if (body){
		var resultOBJ = JSON.parse(body);
		if (!isEmpty(resultOBJ)){
			// console.log(body);
			//console.log(resultOBJ[1].city);

			console.log("I have to do more reading");
			for (var i=0; i < resultOBJ.length; i++){
				hotelList.push(resultOBJ[i]);
				//console.log(hotelList[i]);
			}
			count = count + resultOBJ.length;
			offset = offset + count + 1;
			console.log(offset);
			console.log("count = "+count);
			console.log("Read "+ resultOBJ.length + " hotels");
			console.log();

			//new call to retrieve further results
			var newArgs = "&offset=" +offset;
			request.get( pathBase+requestParam+newArgs, innerCallback );
			console.log( "requesting "+ pathBase+requestParam+newArgs);
		}
		else{

			// Last call for this session
			//console.log(body);
			console.log("last call");
			if (!isEmpty(resultOBJ)){
				for (var i=0; i < resultOBJ.length; i++){
					hotelList.push(resultOBJ[i]);
				}
				count = count + resultOBJ.length;
				console.log("read "+ resultOBJ.length + " hotels");
			}
			console.log();
			console.log("count = "+count);
			console.log();

			//this is the part where we take the JSON retrieved by Booking, and put in the mongodb that was initialized at the beginning of the script
			collection.insert({retrievalDate:(new Date()).formatYYYYMMDDHHMMSS(),hotelList: hotelList },
					function(err, result) {
					assert.equal(err, null);
					console.log(result);
					BOOKINGdb.close();
					});
 			console.log("collection inserted in the db");
		}

		// Writing the file with the list of hotels, just for logging
		fileName= __dirname+"/" + 'Milan'+ "_Hotel_"+ languagecodes +"_"+new Date().formatYYYYMMDDmmss()+".json"

			fs.writeFile(fileName, JSON.stringify(hotelList), function(err) {
					if(err) {
					return console.log(err);
					}

					console.log("The file was saved!");
					var fileString = fs.readFileSync(fileName, 'utf8');
					//console.log(fileString);
					var obj = JSON.parse(fileString);
					console.log();
					console.log("Saved "+obj.length+" Hotels");
					console.log();
					});
	}
}

function callPaginating( pathBase, requestParam){
	log.info("Calling callPaginating requestParam ="+requestParam);
	//reset count and hotel list
	count = 0;
	console.log("count = "+count);
	hotelList = [];

	if (!requestParam){
		requestParam = "&city_ids=" + city_ids + "&countrycodes=" + countrycodes;
	}
	console.log("Requesting "+pathBase+requestParam);
	//initialized path
	var path = pathBase+requestParam;
	console.log("callPaginating " +path);
	sleep.sleep(1);
	//retrieving the data from Booking. The callback function is used to catch the result, and put it where necessary (file, DB)
	request.get(path, innerCallback );

}


console.log("Started ");
callPaginating(pathBase, null);
