import utils from './utils/utils';
import { UPDATE_FREQ, PAGE_SIZE, RATION } from './utils/globals';
import front from './front/index';
import route from './route/index';
import user from './user/index';
import mapUtils from './utils/mapUtils'
import map from './map/index'
import history from './history/index'


var timeOut;
var run = false;


/**
 * Declares a new object in the window namely QueryString that contains every get parameter from the current URL as a property
 */
window.QueryString = function () {
    // This function is anonymous, is executed immediately and 
    // the return value is assigned to QueryString!
    var query_string = {};
    var query = window.location.search.substring(1);
    var vars = query.split("&");

    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");

        // If first entry with this name
        if (typeof query_string[pair[0]] === "undefined") {
            query_string[pair[0]] = decodeURIComponent(pair[1]);
            // If second entry with this name
        } else if (typeof query_string[pair[0]] === "string") {
            var arr = [query_string[pair[0]], decodeURIComponent(pair[1])];
            query_string[pair[0]] = arr;
            // If third or later entry with this name
        } else {
            query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
    }

    return query_string;
}();


/**
 * This function returns an object that contains every get parameter from a URL (first argument) as a property
 * 
 * @param URL {String}
 */
function QueryString(URL) {
    // This function is anonymous, is executed immediately and 
    // the return value is assigned to QueryString!
    var query_string = {};
    var usefulParam = URL.split("?")[1] || "";
    var query = usefulParam || "";
    var vars = query.split("&");

    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        
        // If first entry with this name
        if (typeof query_string[pair[0]] === "undefined") {
            query_string[pair[0]] = decodeURIComponent(pair[1]);
            // If second entry with this name
        } else if (typeof query_string[pair[0]] === "string") {
            var arr = [query_string[pair[0]], decodeURIComponent(pair[1])];
            query_string[pair[0]] = arr;
            // If third or later entry with this name
        } else {
            query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
    }

    return query_string;
}


$(function () {

    /** Init shared */
    get_rowInfo(false, "");

    $(document).on("click", '.main', function (e) {
        loadMain();
    });


    function loadSession(name) {
        $('#load').load('/sessions', function () {
            $(this).find('#routes').each(route.loadRoutes);
            $(this).find('#session-user').each(user.loadUsers);
            $(this).find('#history-session').each(function () {
                var title = "History";
                $.get("/session/" + name, function (data) {
                    var html = getHtml(title, data.endStats, true);
                    $('#routes').val(data.route);
                    $('#session-user').val(data.user);
                    if (html) {
                        $('#table-content').html(html);
                        $('#laps-body').html(getLapHtml(title, data.endStats));
                        addGpxTrackToMap(name, $("#live-map"));
                    }
                    addGraph(data.raw, data.rawHr, parseInt(data.start), data.stroke);
                });
            });
        });
    }


    function loadGpxMap() {
        var name = $(this).data('name');
        var element = $(this).find('.card-map-top');
        addGpxTrackToMap(name, element);
    }


    function createRouteNavPage(page, index) {
        var htmlElement = $('<ul id="route-page" data-index="' + index + '"></ul>').addClass("pagination pagination-lg");
        $.get("routes/size", function (data) {
            var size = parseInt(parseInt(data) / PAGE_SIZE) + 1;
            var prevDisabled = (index === 0 ? 'disabled' : '');
            var nextDisabled = (index === size - 1 ? 'disabled' : '');
            var prev = $('<li class="page-item ' + prevDisabled + '"></li>').append('<a class="page-link" href="#" data-next="-1" tabindex="-1">Previous</a>');
            var next = $('<li class="page-item ' + nextDisabled + '"></li>').append('<a class="page-link" data-next="1" href="#">Next</a>');

            htmlElement.append(prev);
            for (var i = 0; i < size; i++) {
                var active = '';
                if (index === i) {
                    active = "active";
                }
                var item = $('<li class="page-item ' + active + '"><a class="page-link" data-index="' + i + '" href="#">' + (i + 1) + '</a></li>');
                htmlElement.append(item);
            }
            htmlElement.append(next);
            $(page).html(htmlElement);
        });
    }

    var clickSession = function (e) {
        e.preventDefault();
        var name = $(this).data('name');
        loadSession(name);
    };

    $(document).on("click", '#user', function (e) {
        user.loadUser();
    });

    $(document).on("click", '#history-page a', function (e) {
        e.preventDefault();
        var next = parseInt($(this).data('next')), index = parseInt($(this).data('index')),
            mainIndex = parseInt($('#history-page').data('index'));
        if (!isNaN(next)) {
            mainIndex += next;
        } else if (!isNaN(index)) {
            mainIndex = index;
        }
        history.loadHistoryList($('#history-table'), mainIndex);
    });

    //TODO: refactory
    $(document).on("click", '#route-page a', function (e) {
        e.preventDefault();
        var next = parseInt($(this).data('next')), index = parseInt($(this).data('index')),
            mainIndex = parseInt($('#route-page').data('index'));
        if (!isNaN(next)) {
            mainIndex += next;
        } else if (!isNaN(index)) {
            mainIndex = index;
        }
        var pag = $('#routes-table').find('.page');
        createRouteNavPage(pag[0], mainIndex);
        loadRouteTable(mainIndex);
    });

    $(document).on("click", '.nav-link', function (e) {
        $('#main-nav').find(".nav-item").each(function () {
            $(this).removeClass("active");
        });
        $(this).parent().addClass("active");
    });

    $(document).on("click", '.sessions', clickSession);

    $(document).on("click", 'a#history', function (e) {
        history.loadHistoryIndex(0, 0);
    });

    $(document).on("click", 'a#route', function (e) {
        loadRoute(0);
    });

    function loadRoute(mainIndex) {
        $('#load').load('/route', function () {
            $(this).find('#routes-t').each(function () {
                loadRouteTable(0);
                var pag = $('#routes-table').find('.page');
                createRouteNavPage(pag[0], mainIndex);
            });
        });
    }

    function loadRouteTable(mainIndex) {
        var start = mainIndex * PAGE_SIZE, stop = (((mainIndex + 1) * PAGE_SIZE)) - 1;
        $.get('/routes/' + start + '/' + stop, function (data) {
            var htmlTable = '';
            var index = 0;
            data.forEach(function (route) {
                htmlTable = createRouteRecord(htmlTable, index + (mainIndex * PAGE_SIZE), route);
                index++;
            });

            $('#routes-table-body').html(htmlTable);
            $('#add-route-modal').on('hidden.bs.modal', function (e) {
                loadRoute(0);
            })
        });
    }

    $(document).on("load-map", '.gpx-track', loadGpxMap);

    $(document).on("click", 'button#startRow', function (e) {
        e.preventDefault();
        var routes = $('#routes').val();
        var that = this;
        $.get("/row/start", { routes: routes }, function () {
            start(that);
        });
    });

    function start(startButton) {
        $(window).scrollTop($('#main').offset().top); //Scroll
        get_rowInfo(true, "Rowing");
        mapUtils.cleanMap();
        $('#routes').attr('disabled', 'disabled');
        $('#session-user').attr('disabled', 'disabled');
        $("#startSimulator").attr('disabled', 'disabled');
        $(startButton).attr('disabled', 'disabled');
        $(startButton).html('Rowing...');
        $(startButton).addClass('d-none');
        $('#stopRow').removeClass('d-none');
    }

    $(document).on("click", 'button#stopRow', function (e) {
        e.preventDefault();
        var that = $(this);
        clearTimeout(timeOut);
        run = false;
        var routes = $('#routes').val();
        var user = $('#session-user').val();
        $.get("/row/stop", { routes: routes, user: user }, function (data) {
            $('#table-content').html(getHtml("Stopped", data, false));
            var startRow = $("#startRow");
            startRow.removeAttr('disabled');
            startRow.removeClass('d-none');
            startRow.html('Start row');
            that.addClass('d-none');
            $('#routes').removeAttr('disabled');
            $('#session-user').removeAttr('disabled');
            $("#startSimulator").removeAttr('disabled');
        });
    });

    $(document).on("click", '.edit-user', function (e) {
        e.preventDefault();
        var id = $(this).data('id');
        $.ajax({
            url: '/users/' + id,
            type: 'GET',
            success: function (result) {
                var form = $("#addUserForm");
                form.find('#firstName').val(result.firstName);
                form.find('#lastName').val(result.lastName);
                form.find('#userId').val(result.id);
                $.get('/strava/url', function (data) {
                    var url = data.url.replace("%24", result.id);
                    $('.strava-url').attr('href', url);
                });
                var connect = $(".strava-connect");
                connect.removeClass("sr-only");
                $('#addUserModal').modal('show');
            }
        });
    });
    $(document).on("click", '.edit-route', function (e) {
        e.preventDefault();
        var id = $(this).data('id');
        $.ajax({
            url: '/routes/' + id,
            type: 'GET',
            success: function (result) {
                var form = $("#addRoute");
                form.find('#name').val(result.name);
                form.find('#meters').val(result.meters);
                form.find('#segmentId').val(result.segmentId);
                form.find('#countries').val(result.country);
                //gps.replace(/(.*),(.*),(.*)/gm, '{ "lat": $1, "lon": $2, "el": $3 },');
                var gpsCvs = JSON.stringify(result.gps);
                form.find('#gps').append(gpsCvs);
                $('#add-route-modal').modal('show');
            }
        });
    });

    $(document).on("click", '.strava', function (e) {
        e.preventDefault();
        var href = $(this).attr('href');
        $.get(href, function (data) {
            console.log(data);
            alert("Uploaded to strava!");
        });
    });

    $(document).on("click", '.del-session', function (e) {
        e.preventDefault();
        var name = $(this).data('name');
        var result = confirm("Are you sure you want to delete session?");
        if (result) {
            $.ajax({
                url: '/session/del/' + name,
                type: 'DELETE',
                success: function (result) {
                    alert("Session deleted");
                    history.loadHistoryIndex(0, 0);
                }
            });
        }
    });

    $(document).on("click", "#save-route", function (event) {
        event.preventDefault();
        var form = $("#addRoute");
        var route = {};
        route.name = form.find('#name').val();
        route.meters = form.find('#meters').val();
        route.stravaId = form.find('#segmentId').val();
        route.country = form.find('#countries').val();
        route.gps = form.find('textarea').val();
        $.ajax({
            type: 'PUT',
            contentType: 'application/json',
            dataType: 'json',
            url: "/routes/add",
            data: JSON.stringify(route),
            success: function () {
                $('#add-route-modal').modal('hide');
            }
        });
    });

    $(document).on("click", "#save-user", function (event) {
        event.preventDefault();
        var form = $("#addUserForm");
        var firstName = form.find('#firstName').val();
        var lastName = form.find('#lastName').val();
        var id = form.find('#userId').val();
        var user = {};
        user.firstName = firstName;
        user.lastName = lastName;
        user.id = id;
        $.ajax({
            type: 'PUT',
            contentType: 'application/json',
            dataType: 'json',
            url: "/users/add",
            data: JSON.stringify(user),
            success: function () {
                $('#addUserModal').modal('hide');
            }
        });

    });

    $(document).on("click", '.del-user', function (e) {
        e.preventDefault();
        var id = $(this).data('id');
        var result = confirm("Are you sure you want to delete?");
        if (result) {
            $.ajax({
                url: '/users/' + id,
                type: 'DELETE',
                success: function (result) {
                    user.loadUser();
                }
            });
        }
    });

    $(document).on("click", '.del-route', function (e) {
        e.preventDefault();
        var id = $(this).data('id');
        var result = confirm("Are you sure you want to delete route?");
        if (result) {
            $.ajax({
                url: '/routes/' + id,
                type: 'DELETE',
                success: function (result) {
                    loadRoute(0);
                }
            });
        }
    });


    $('#load').each(function () {
        var hash = window.location.hash;
        switch (hash) {
            case '#route':
                loadRoute(0);
                break;
            case '#user':
                user.loadUser();
                break;
            case '#history':
                history.loadHistory(0);
                break;
            case '#session':
                loadSession(QueryString["name"]);
                break;
            default:
                front.loadMain();
        }
    });

    $('#routes').each(route.loadRoutes);

    $('#session-user').each(user.loadUsers);

    $(document).on('show.bs.modal', '#show-route-modal', function (e) {
        var name = $(e.relatedTarget).data('route-name');
        var that = $(this);
        $.get("/routes/" + name, function (data) {
            var title = data.name;
            if (data.segementId) {
                title = '<a target="_blank" href="https://www.strava.com/segments/' + data.segementId + '">' + title + ' </a>';
            }
            that.find('#show-route-modal-title').html(title);
            var html = '<li class="list-group-item"><h5 class="card-title">Display Lenght:</h5>' + data.meters + ' m</li>';
            html += '<li class="list-group-item"><h5 class="card-title">Gps Lenght:</h5>' + data.gpsLenght + ' m</li>';
            html += '<li class="list-group-item"><h5 class="card-title">Country:</h5>' + data.country + '</li>';
            that.find('.card .list-group').html(html);
        });
    });

    $(document).on('shown.bs.modal', '#show-route-modal', function (e) {
        var name = $(e.relatedTarget).data('route-name');
        addRouteTrackToMap(name, $("#live-route-map"));
    });

    $(document).on("change", '#routes', function (e) {
        var selected = $('#routes').find(":selected");
        mapUtils.cleanMap();
        var p = new google.maps.LatLng($(selected).data("lat"), $(selected).data("lon"));
        map.liveMap.panTo(p);
    });
});

function get_rowInfo(continues, title) {
    run = continues;
    $.get("/row", function (data) {
        var html = getHtml(title, data);
        if (html) {
            $('#table-content').html(html);
            $('#laps-body').html(getLapHtml(title, data, true));
            var lat = data.gps.lat;
            var lon = data.gps.lon;
            var p = new google.maps.LatLng(lat, lon);
            map.livePoints.push(p);
            if (map.liveBounds) {
                map.liveBounds.extend(p);
                var poly = mapUtils.createPolyLine(map.livePoints);
                poly.setMap(map.liveMap);
                map.liveMap.fitBounds(map.liveBounds);
            }

        }
    }).done(function () {
        if (run) {
            timeOut = setTimeout(function () { get_rowInfo(true, title); }, UPDATE_FREQ);
        }
    });
}

function getHtml(label, json, day) {
    if (parseInt(json.meters) === 0) {
        return;
    }
    var html = '';
    if (day) {
        html += '<div class="row"><div class="col-sm-4">Day</div><div class="col">' + json.start.substr(2, json.start.lastIndexOf('T') - 2) + '</div></div>';
    }
    html += '<div class="row"><div class="col-sm-4">Start:</div><div class="col">' + json.start.substr(json.start.lastIndexOf('T') + 1, 8) + '</div></div>';
    html += '<div class="row"><div class="col-sm-4">Time:</div><div class="col">' + utils.fmtMSS(parseInt(json.seconds)) + '</div></div>';
    html += '<div class="row"><div class="col-sm-4">Length:</div><div class="col">' + parseInt(json.meters) + ' m (' + parseInt(json.routeLap) + ')</div></div>';
    html += '<div class="row"><div class="col-sm-4">Pace:</div><div class="col">' + Math.round(parseFloat(json.pace) * 3.6 * 10) / 10 + ' km/t</div></div>';
    html += '<div class="row"><div class="col-sm-4">500m:</div><div class="col">' + utils.fmtMSS(parseInt(json.lapPace)) + '</div></div>';
    html += '<div class="row"><div class="col-sm-4">2k:</div><div class="col">' + utils.fmtMSS(parseInt(json.towKPace)) + '</div></div>';
    html += '<div class="row"><div class="col-sm-4">Avg.W:</div><div class="col">' + Math.round(parseFloat(json.watt) * 10) / 10 + 'w</div></div>';
    html += '<div class="row"><div class="col-sm-4">SR:</div><div class="col">' + Math.round(parseFloat(json.stroke) * 10) / 10 + '</div></div>';
    if (parseInt(json.hr) > 0) {
        html += '<div class="row"><div class="col-sm-4">HR:</div><div class="col ' + utils.getHeartRateColor(parseInt(json.hr)) + '">' + parseInt(json.hr) + (parseInt(json.avgHr) > 0 ? '(' + parseInt(json.avgHr) + ')' : '') + '</div></div>';
    }
    if (json.fileName) {
        html += '<div class="row"><div class="col">Actions:</div><div class="col"><a href="/sessions/' + json.fileName;
        html += '"><i class="material-icons">file_download</i><a class="strava" href="/strava/upload/' + json.name;
        html += '"><i aria-hidden="true" title="Upload to strava" class="material-icons">cloud_upload</i></a>';
        html += '<a class="sessions" data-name="' + json.name + '" href="/sessions"><i aria-hidden="true" title="Session" class="material-icons">fiber_new</i></a></div></div>';
    }
    return html + "";
}

function getLapHtml(label, json, reverse) {
    var html = '';
    if (parseInt(json.totalLaps) > 0) {
        var lapNum = 1;
        var laps = json.laps;
        if (reverse) {
            laps.reverse();
            lapNum = laps.length;
        }
        laps.forEach(function (value) {
            html += '<tr><th scope="row">' + lapNum + '</th><td>' + parseInt(value.meters) + '</td><td>' + utils.fmtMSS(parseInt(value.seconds)) + '</td>';
            html += '<td>' + Math.round(parseFloat(value.watt) * 10) / 10 + 'w</td></tr>';
            if (reverse) {
                lapNum--;
            } else {
                lapNum++;
            }
        }
        );
    }
    return html;
}



var createRouteRecord = function (htmlTable, index, route) {
    htmlTable += '<tr>';
    htmlTable += '<th scope="row">' + (index + 1) + '</th>';
    htmlTable += '<td><a data-toggle="modal" data-route-name="' + route.name + '" data-target="#show-route-modal" href="/routes/' + route.name + '">' + route.name + '</a></td>';
    htmlTable += '<td>' + parseInt(route.meters) + 'm</td>';
    htmlTable += '<td>' + route.country + '</td>';
    htmlTable += '<td>'
    if (route.permanent !== true) {
        htmlTable += '<a class="edit-route" href="#" data-id="' + route.name + '"><i class="material-icons">create</i></a><a class="del-route" href="#" data-id="' + route.name + '"><i aria-hidden="true" title="Delete route" class="material-icons">delete</i></a>' + '</td>';
    }
    htmlTable += '</tr>';
    return htmlTable;
};

var addGpxTrackToMap = function (name, element) {
    if (name) {
        $.ajax({
            type: "GET",
            url: '/sessions/' + name + '.gpx',
            success: function (xml) {
                var points = [];
                var map = new google.maps.Map(element[0], {
                    zoom: 16
                });

                map.set('styles', mapUtils.styles);

                var bounds = new google.maps.LatLngBounds();

                $(xml).find("trkpt").each(function () {
                    var lat = $(this).attr("lat");
                    var lon = $(this).attr("lon");
                    var p = new google.maps.LatLng(lat, lon);
                    points.push(p);
                    bounds.extend(p);
                });

                var poly = mapUtils.createPolyLine(points);

                poly.setMap(map);

                // fit bounds to track
                map.fitBounds(bounds);
            }
        });
    }
};

var addRouteTrackToMap = function (name, element) {
    if (name) {
        $.ajax({
            type: "GET",
            url: '/routes/' + name,
            success: function (data) {
                var points = [];
                var map = new google.maps.Map(element[0], {
                    zoom: 8,
                    maxZoom: 16
                });

                map.set('styles', mapUtils.styles);

                var bounds = new google.maps.LatLngBounds();

                data.gps.forEach(function (point) {
                    var lat = point.lat;
                    var lon = point.lon;
                    var p = new google.maps.LatLng(lat, lon);
                    points.push(p);
                    bounds.extend(p);
                });

                var poly = mapUtils.createPolyLine(points);

                poly.setMap(map);

                // fit bounds to track
                map.fitBounds(bounds);
            }
        });
    }
};

function addGraph(time, hr, start, strokes) {
    var speed = [];
    var watt = [];
    var stroke = [];
    var strokeConter = 1;
    for (var i = 1; i < time.length; i++) {
        var timeVal = parseInt(time[i]);
        var strokeTime = parseInt(strokes[strokeConter]);
        var sec = ((timeVal - start) / 1000);
        var lenght = (RATION / 100);
        speed.push(((lenght / sec)) * 3.6);
        var wattValue = utils.calcWatt(sec / lenght);
        watt.push(wattValue);
        stroke.push(1000*60 / (strokeTime - parseInt(strokes[strokeConter-1])));
        start = parseInt(time[i]);
        if (timeVal > strokeTime) {
            strokeConter++;
        }
    }

    //Remove ever second element
    var speedMerged = [];
    var hrMerged = [];
    var wattMerged = [];
    var strokeMerged = [];
    var labelsMerged = [];
    var mergeSize = 10;
    if (time.length > 1000) {
        mergeSize = 20;
    }

    while (time.length) {
        var a = time.splice(0, mergeSize);
        var timeV = parseInt(a.reduce(function (a, b) { return a + b; }) / a.length);
        labelsMerged.push(new Date(timeV).toISOString().substr(new Date(timeV).toISOString().lastIndexOf('T') + 1, 8));
        if (hr) {
            var h = hr.splice(0, mergeSize);
            if (h.length > 0) {
                hrMerged.push(parseInt(h.reduce(function (a, b) { return a + b; }) / h.length));
            }
        }
        if (stroke) {
            var h = stroke.splice(0, mergeSize);
            if (h.length > 0) {
                strokeMerged.push(Math.round(parseFloat(h.reduce(function (a, b) { return a + b; }) / h.length) * 10) / 10);
            }
        }
        if (speed) {
            var s = speed.splice(0, mergeSize);
            var w = watt.splice(0, mergeSize);
            if (s.length > 0) {
                speedMerged.push(Math.round(parseFloat(s.reduce(function (a, b) { return a + b; }) / s.length) * 10) / 10);
            }
            if (w.length > 0) {
                wattMerged.push(Math.round(parseFloat(w.reduce(function (a, b) { return a + b; }) / w.length) * 10) / 10);
            }
        }
    }

    var ctx = $('#hr-graph');
    var lineChartData = {
        labels: labelsMerged,
        datasets: [{
            label: 'Heart rate (bpm)',
            borderColor: '#dc3545',
            backgroundColor: '#dc3545',
            fill: false,
            data: hrMerged,
           // cubicInterpolationMode: 'monotone',
            yAxisID: 'y-axis-1',
        }, {
            label: 'Speed (km/t)',
            borderColor: '#007bff',
            backgroundColor: '#007bff',
            fill: false,
            data: speedMerged,
            //cubicInterpolationMode: 'monotone',
            yAxisID: 'y-axis-2'
        },
        {
            label: 'Watt',
            borderColor: '#4bc0c0',
            backgroundColor: '#4bc0c0',
            fill: false,
            data: wattMerged,
            lineTension: 0,
            //cubicInterpolationMode: 'monotone',
            yAxisID: 'y-axis-3'
        },
        {
            label: 'Stroke rate (spm)',
            borderColor: '#9966FF',
            backgroundColor: '#9966FF',
            fill: false,
            data: strokeMerged,
            yAxisID: 'y-axis-4'
        }]
    };
    var myLineChart = Chart.Line(ctx, {
        data: lineChartData,
        options: {
            responsive: true,
            hoverMode: 'index',
            stacked: false,
            scales: {
                yAxes: [{
                    type: 'linear', // only linear but allow scale type registration. This allows extensions to exist solely for log scale for instance
                    display: true,
                    position: 'left',
                    id: 'y-axis-1',
                    ticks: {
                        suggestedMin: 30,
                        min: 0,
                        stepSize: 5
                    }
                }, {
                    type: 'linear', // only linear but allow scale type registration. This allows extensions to exist solely for log scale for instance
                    display: true,
                    position: 'right',
                    id: 'y-axis-2',
                    ticks: {
                        stepSize: 2
                    },
                    // grid line settings
                    gridLines: {
                        drawOnChartArea: false // only want the grid lines for one axis to show up
                    }
                },
                {
                    type: 'linear', // only linear but allow scale type registration. This allows extensions to exist solely for log scale for instance
                    display: true,
                    position: 'right',
                    id: 'y-axis-3',
                    ticks: {
                        stepSize: 25
                    },
                    // grid line settings
                    gridLines: {
                        drawOnChartArea: false // only want the grid lines for one axis to show up
                    }
                },
                {
                    type: 'linear', // only linear but allow scale type registration. This allows extensions to exist solely for log scale for instance
                    display: true,
                    position: 'right',
                    id: 'y-axis-4',
                    ticks: {
                        stepSize: 2,
                        suggestedMin: 10,
                    },
                    // grid line settings
                    gridLines: {
                        drawOnChartArea: false // only want the grid lines for one axis to show up
                    }
                }]
            }
        }
    });
}
