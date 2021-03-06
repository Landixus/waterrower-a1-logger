try {
    var Gpio = require('onoff').Gpio;
} catch (e) {
    console.log("GPIO is not supported.")
}
try {
    var Ant = require('ant-plus');
}catch (e) {
    console.log("Ant plus not supported.")
}
const dateFormat = require('dateformat');
const debounce = require('debounce');
const createGpx = require('gps-to-gpx');
const sanitize = require("sanitize-filename");
const DateDiff = require('date-diff');

const RATION = 100 / 4.805; // 100 cm is 4.805 clicks. About 20.81 cm.
const PID = 4;
const DEBOUNCE_TIME = 5; // 5ms
const SAMPLE_SIZE = 6;
const WATT_RATION = 2.80;
const MILLIS_MIN = 60 * 1000;

var sensor;
var runSimulator = false;

function RowSession(status, route) {
    this.status = status;
    this.stroke = [];
    this.counter = 0;
    this.start = Date.now();
    this.raw = [];
    this.rawHr = [];
    this.hr = -1;
    this.usingHr = false;
    this.p = null;
    this.name = sanitize(new Date(this.start).toISOString());
    this.routeObject = route;
    this.routeObjectLenght = route.getRouteLength();
    this.avgHr = -1;
}

RowSession.prototype.heartRate = function () {
    if (typeof Ant !== 'undefined' && Ant) {
        this.stick = new Ant.GarminStick2();
        openStick.bind(this)(this.stick, 1);
    }
};

function openStick(stick, stickid) {
    var scanner = new Ant.HeartRateScanner(stick);
    var that = this;
    scanner.on('hbdata', function(data) {
        that.hr = data.ComputedHeartRate;
    });

    scanner.on('attached', function() { console.log(stickid, 'scanner attached'); that.usingHr = true; });
    scanner.on('detached', function() { console.log(stickid, 'scanner detached'); });

    stick.on('startup', function() {
        console.log(stickid, 'startup');
        console.log(stickid, 'Max channels:', stick.maxChannels);
        scanner.scan();
    });

    stick.on('shutdown', function() { console.log(stickid, 'shutdown'); });

    function tryOpen(stick) {

        this.token = stick.openAsync(function(err){
            this.token = null;
        if (err) {
            console.error(stickid, err);
        } else {
            console.log(stickid, 'Stick found');
        }
    });

        return token;
    }


    tryOpen(stick);
}

RowSession.prototype.simulate = function() {
    this.sim = true; //mark this as sim
    console.log("Starting RowSession simulator");
    runSimulator = true;
    //this.heartRate();
    var that = this;
    (function loop() {
        if(runSimulator) {
            var rand = getRandomRowerSpeed((that.totalInMeters() % 1000) <= 500);
            setTimeout(function () {
                that.increase();
                that.hr = getRandomArbitrary(76, 220);
                loop();
            }, rand);
        }
    }());
};

RowSession.prototype.increase = function() {
    this.increment(); //TODO: Debunce?
};

RowSession.prototype.totalLaps = function () {
    return (this.totalInMeters() / 500)|0;
};

RowSession.prototype.laps = function () {
    var laps = [], totalLaps = this.totalLaps();
    if (totalLaps === 0) {
        return laps;
    }

    for (var i = 0; i < totalLaps; i++) {
        var lapSize = 500;
        var index = Math.floor(getClicksByMeters(500) / SAMPLE_SIZE);
        var startIndex = index * (i);
        var endIndex = index * (i + 1);
        var startTime = this.raw[startIndex];
        var endTime = this.raw[endIndex];
        var seconds = ((endTime - startTime) / 1000);
        var wattValue = watt(seconds/lapSize);
        laps.push({start: dateFormat(startTime, "isoDateTime"), end: dateFormat(endTime, "isoDateTime"), meters: lapSize, seconds: seconds, watt: wattValue});
    }
    return laps;
};

RowSession.prototype.increment = function() {
    this.counter = this.counter + 1;
    if (this.counter % SAMPLE_SIZE === 1) { //Total length
        let time = Date.now();
        this.raw.push(time);
        if (this.hr > 0) { // hr <= 0 means dead.
            this.rawHr.push(this.hr);
        }
        let rawTime = new Date(time);
        let distance = this.getLengthInMetersByClicks(6); //6 click per raw.
        this.p = this.routeObject.nextPoint(this.p, distance.toFixed(4));
        this.trackPoint = {
            'lat': this.p.lat.toFixed(7),
            'lon': this.p.lon.toFixed(7),
            ele: 0,
            time: rawTime.toISOString()
        };

        if (this.raw.length > 2) {
            var length = this.raw.length - 1 ;
            var diffFirst = this.raw[length-1] - this.raw[length-2];
            var diffSecond = this.raw[length] - this.raw[length-1];
            if ((diffFirst - diffSecond) >= 0) {
                addStrokeDebouce(this.stroke, this.raw[length])
            }
        }
    }
};

RowSession.prototype.startRow = function() {
    this.heartRate();
    sensor = new Gpio(PID, 'in', 'falling');
    var that = this;
    sensor.watch(function (err, value) {
        if (err) {
            throw err;
        }
        //console.log("Registered event. " + value);
        that.increase();
    });
};

RowSession.prototype.stop = function() {
    console.log("Stopping RowSession");
    if (sensor) {
        sensor.unexport();
    }
    if (runSimulator) {
        runSimulator = false;
    }
    try {
        if (this.stick) {
            this.stick.close();
            delete this.stick;
        }
        if (this.token) {
            this.token.cancel();
            delete this.token;
        }
    } catch (e) {
        console.log("Error with stick. " + e);
    }

    this.endStats = this.stats();
};

RowSession.prototype.getTotalLength = function() {
    return this.counter * RATION;
};

RowSession.prototype.getStrokeRate = function() {
    if (this.stroke.length > 1) {
        var length = this.stroke.length -1;
        return MILLIS_MIN / (this.stroke[length] - this.stroke[length-1]);
    } else {
        return 0;
    }
};

RowSession.prototype.getLengthByClicks = function(clicks) {
    return clicks * RATION;
};

RowSession.prototype.getLengthInMetersByClicks = function(clicks) {
    return this.getLengthByClicks(clicks) / 100;
};

RowSession.prototype.stats = function() {
    var stats = {};
    stats.length = this.getTotalLength();
    stats.meters = this.totalInMeters();
    stats.seconds = this.totalTimeInSec();
    stats.start = dateFormat(this.start, "isoDateTime");
    stats.pace = this.meterPerSeconds();
    stats.lapPace = this.fiveHundrePace();
    stats.towKPace = this.twoKPace();
    stats.totalLaps = this.totalLaps();
    stats.laps = this.laps();
    stats.avgHr = this.getAvgHr();
    stats.gps = this.trackPoint;
    stats.stroke = this.getStrokeRate();
    stats.hr = this.hr;
    stats.routeLap = this.getRouteLap();
    stats.percent = this.getPercent();
    stats.routeLength = this.routeObjectLenght;
    stats.watt = watt(this.totalTimeInSec() / this.totalInMeters());
    return stats;
};

RowSession.prototype.totalInMeters = function () {
    return this.getTotalLength() / 100
};

RowSession.prototype.getRouteLap = function () {
    return ((this.totalInMeters() / this.routeObjectLenght) | 0) + 1;
};

RowSession.prototype.getPercent = function () {
    return ((this.totalInMeters() / this.routeObjectLenght)).toFixed(2);
};

RowSession.prototype.totalTimeInSec = function () {
    return this.totalTime() / 1000
};

RowSession.prototype.totalTime = function () {
    return Date.now() - this.start
};

RowSession.prototype.meterPerSeconds = function () {
    return this.totalInMeters() / this.totalTimeInSec()
};

RowSession.prototype.getAvgHr = function () {
    if (this.rawHr.length > 0) {
        return (this.rawHr.reduce(function (total, num) {return total + num}) / this.rawHr.length) | 0;
    } else return 0;
};

RowSession.prototype.fiveHundrePace = function () {
    return 500 / this.meterPerSeconds();
};

RowSession.prototype.twoKPace = function () {
    return 2000 / this.meterPerSeconds();
};

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

function getRandomRowerSpeed(fast) {
    return getRandomArbitrary(10, 120) * ( fast ? 0.7 : 1)
}

function getClicksByMeters(meters) {
    var cm = meters * 100;
    return Math.floor(cm / RATION);
}

function watt(pace) {
    return WATT_RATION / Math.pow(pace, 3);
}

function addStroke(stroke, val) {
    stroke.push(val);
}

RowSession.prototype.getStrokes = function () {
    return this.stroke;
}

const addStrokeDebouce = debounce(addStroke, 1250);

// export the class
module.exports = RowSession;

