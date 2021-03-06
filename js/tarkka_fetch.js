/*
 * Fetches latest hourly prices for 'Fortum Tarkka' from
 * http://tuotanto.heyday.fi/fortum/tarkka/graafi.php and
 * stores them in a file. If the file exists and contains
 * data for today, does nothing.
 * 
 * Requires: http
 *           fs
 * 
 * 
 *  Copyright 2015 Ilkka Kaakkola <xenic@iki.fi>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

//
// Configuration
//
// the host and path to request data from
var httpOptions = {
    "host": "tuotanto.heyday.fi",
    "path": "/fortum/tarkka/graafi.php"
}

//
// Globals
//
var fs = require( 'fs' );
var http = require( 'http' );
var today = new Date();
today.setHours( 0 );
today.setMinutes( 0 );
today.setSeconds( 0 );
today.setMilliseconds( 0 );
var resultFile = null;

//
// Callback functions
//

// HTTP request callback
var httpCallback = function( response ) {
    var body = "";
    response.on( "data", function( part ) {
            body += part;
        } );
    response.on( "end", function() {
            var result = parseResponse( body );
            processResult( result );
        } );
}

// Parse the HTTP response body, returning an array containing hourly price
var parseResponse = function( body ) {
    // Completed, parse result
    if( body === "" ) {
        throw( "No data received." );
    }
    var hours = [];
    try {
        var lines = body.split( /(\r|\n)+/ );
        for( var i = 0; i < lines.length; i++ ) {
            var l = lines[ i ].trim();
            if( l.indexOf( "{ data:" ) === 0 ) {
                // Opening [ is on previous row
                l = "[" + l;
                // Remove trailing unwanted data
                l = l.replace( /, options\);/, "" );
                // Surround keys with double quotes
                l = l.replace( /([a-zA-Z0-9]+)\:/g, "\"$1\":" );
                // Convert single quotes to double quotes
                l = l.replace( /\'/g, "\"" );
                var json = JSON.parse( l );
                for( var j = 0; j < json.length; j++ ) {
                    // Price is in member 1 of member 0 of the data array
                    // {"data":[[18,4.63]],"highlightColor":"#529900","bars":{"show":true,"fill":true,"barWidth":0.7,"align":"center","lineWidth":0,"fillColor":"#529900"}}
                    var price = json[ j ].data[ 0 ][ 1 ];
                    hours.push( price );
                }
                break;
            }
        }
    } catch( e ) {
        throw( "Parse failure: " + e );
    }
    return hours;
}

// Process the result
var processResult = function( result ) {
    var resultObj = {
        "time": today.getTime(),
        "data": result
    }

    fs.writeFile( resultFile, JSON.stringify( resultObj ), 'utf8', function( err ) {
            if( err == null ) {
                console.log( "Saved '" + resultFile + "'" );
                return;
            }
            console.log( "Unable to save '" + resultFile + "': " + err );
        } );
}

// Help on usage
var usage = function() {
    console.log( "Usage: nodejs tarkka_fetch.js resultFile" );
    console.log( "\nresultFile is the full filesystem path to store results to.\n" );
    console.log( "This script fetches latest 'Tarkka' hourly pricess\nand store them locally once per day.\n" );
    process.exit( 1 );
}

//
// Main
//

var args = process.argv.splice( 2 );
if( args.length == 0 ) {
    usage();
}

resultFile = args[ 0 ];

// Look for result file, if it exists and contains data for today, do nothing
var valid = false;
try {
    var fileStats = fs.statSync( resultFile );
    if( !fileStats.isFile() ) {
        console.log( "'" + resultFile + "' is not a file." );
        process.exit( 1 );
    }

    var data = JSON.parse( fs.readFileSync( resultFile, 'utf8' ) );
    if( data.time >= today.getTime() ) {
        valid = true;
    }
} catch( e ) {
    // Ok, we will fetch and write the file
    console.log( "Could not check '" + resultFile + "': " + e );
}

if( valid ) {
    console.log( "Found valid data for today in '" + resultFile + "', nothing to do." );
    process.exit( 0 );
}

// Fetch and store data
var httpRequest = http.request( httpOptions, httpCallback );
httpRequest.end();
