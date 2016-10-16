var play = false;
var ready = false;

//time variables
var animationTime, prevRealTime;	//related to animation time
var timestep = 1; //speed

//"particle manager"
var particleManager;

//WebGL things
var renderer, scene, camera, particleMesh, material, vertexShader, fragmentShader, interleavedBuffer;

//Map variables
var map, googleMap, openStreetMap;
var fromProj, toProj;


var init = function() {
	if(localStorage.getItem("useOSM") == 1) {
		document.getElementById('map_provider').value = 1;
	}
	
	//Get vertex shader from file
	$.get(window.location.pathname + "shaders/vertex.shader", function(data) {
		vertexShader = data;
	});
	
	//Get fragment shader from file
	$.get(window.location.pathname + "shaders/fragment.shader", function(data) {
		fragmentShader = data;
	});
	
	$("#visible_add_data").click(function() {
		$("#hidden_add_data").trigger("click");
	});
	
	document.getElementById('hidden_add_data').onchange = function(){
		if(typeof this.files[0] === 'undefined'){
			return;
		}
		ready = false;
		stop();
		
		showLoading(true);
		if(typeof particleMesh != 'undefined'){
			scene.remove(particleMesh);
		}

		particleManager = new ParticleManager();
		
		readStyles(this.files);
	};
	
	setupTimeBar();
	setupMap(1);
	setupWebgl();
}

var readStyles = function(files) {
	if(files.length == 0 || files.length > 2)
		return;
	else if(files.length == 1) {	//No styles file specified, only objects
		readObjects(files[0]);
		return;
	}
	
	var index;
	if(files[0].name.split('.')[1] == "style")
		index = 0;
	else
		index = 1;
	var reader = new FileReader();
	reader.readAsText(files[index]);
	reader.onload = function(evt) {
		particleManager.setStyles(JSON.parse(evt.target.result));
		readObjects(index == 0 ? files[1] : files[0]);
    };
}

var readObjects = function(file) {
	var navigator = new FileNavigator(file);

	navigator.readSomeLines(0, function linesReadHandler(err, index, lines, eof, progress) {
		console.log('Reading file progress: ', progress);
		
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			particleManager.addData(line);
		}

		if(!eof) {
			setTimeout(function() {
				navigator.readSomeLines(index + lines.length, linesReadHandler);
			}, 0)
		}
		else {
			startMainLoop();
		}
	});
}

var startMainLoop = function() {
	particleManager.createChunks();
	map.getView().fit([particleManager.minLon, particleManager.minLat, particleManager.maxLon, particleManager.maxLat], map.getSize());
	if(map.getView().getZoom() > 12)
		map.getView().setZoom(12);
	
	reset();
	updateTimeBar();
	mainLoop();
}

var mainLoop = function() {
	if(!ready) {
		if(typeof particleManager != 'undefined' && particleManager.ready) {
			createMesh(particleManager.maxChunkSize);
			ready = true;
			showLoading(false);
		}
	}
	setCameraExtent();
	if(play) {
		var newRealTime = new Date().getTime();
		var deltaRealTime = newRealTime - prevRealTime;
		prevRealTime = newRealTime;
		animationTime += deltaRealTime*timestep;
		
		if(animationTime >= particleManager.maxTime) {
			stop();
			animationTime = particleManager.maxTime;
		}
	}
	
	if(particleManager.isChunkOutdated(animationTime)) {
		getDataChunk();
	}
	material.uniforms['time'].value = animationTime;
	updateTimeBar();
	
	renderer.render(scene, camera);
	window.requestAnimationFrame(mainLoop);
}

var getDataChunk = function() {
	var chunk = particleManager.getChunk(animationTime);
	
	interleavedBuffer.array.set(chunk);
	interleavedBuffer.array.fill(0, chunk.length);
	interleavedBuffer.needsUpdate = true;
}

var setCameraExtent = function() {
	var extent = map.getView().calculateExtent(map.getSize());
	
	//Camera bounds
	camera.left = extent[0];
	camera.right = extent[2];
	camera.top = extent[3];
	camera.bottom = extent[1];
	camera.updateProjectionMatrix();
}

var createMesh = function(maxSize) {
	var geometry = new THREE.InstancedBufferGeometry();
	
	interleavedBuffer = new THREE.InterleavedBuffer( new Float32Array( maxSize ), 11 );
	
	geometry.addAttribute( 'position', new THREE.InterleavedBufferAttribute( interleavedBuffer, 3, 0 ) );
	geometry.addAttribute( 'positionNext', new THREE.InterleavedBufferAttribute( interleavedBuffer, 3, 3 ) );

	geometry.addAttribute( 'color', new THREE.InterleavedBufferAttribute( interleavedBuffer, 1, 6 ) );
	geometry.addAttribute( 'alpha', new THREE.InterleavedBufferAttribute( interleavedBuffer, 1, 7 ) );
	
	geometry.addAttribute( 'size', new THREE.InterleavedBufferAttribute( interleavedBuffer, 1, 8 ) );
	geometry.addAttribute( 'zValue', new THREE.InterleavedBufferAttribute( interleavedBuffer, 1, 9 ) );
	geometry.addAttribute( 'mode', new THREE.InterleavedBufferAttribute( interleavedBuffer, 1, 10 ) );
	
	if(typeof particleMesh != 'undefined'){
		scene.remove(particleMesh);
	}
	particleMesh = new THREE.Points( geometry, material );
	particleMesh.frustumCulled = false;
	scene.add( particleMesh );
	getDataChunk();
}

var setupTimeBar = function() {
	$('.clickable').height($('#buttons').height());
	$('.progress').height($('#buttons').height());
	
	$('.clickable').bind('click', function (ev) {
		if(typeof(particleManager) === 'undefined' || typeof(particleManager.maxTime) === 'undefined')
			return;
		
		var $div = $(ev.target);

		var offset = $div.offset();
		var x = ev.clientX - offset.left;
		var factor = x/$('.clickable').width();
		if(factor < 0)
			factor = 0;
		else if(factor > 1)
			factor = 1;
		
		animationTime = factor * particleManager.maxTime;
	});
}

var setupWebgl = function() {
	if(typeof(vertexShader) === 'undefined' || typeof(fragmentShader) === 'undefined') {
		setTimeout(setupWebgl, 500);
		return;
	}
	
	var loader = new THREE.TextureLoader();
	
	material = new THREE.RawShaderMaterial({
		uniforms: {
			texture: { type: "t", value: loader.load( "images/spark1.png" ) },
			time: { type: 'f', value: 0.0 },
			scale: { type: 'f', value: $('#overlay').height()/25 },
			heatmap: { type: 'i', value: 0 }
		},
		transparent: true,
		vertexShader: vertexShader,
		fragmentShader: fragmentShader
	});
	
	var width = $('#overlay').width();
	var height = $('#overlay').height();

	var container = $('#overlay');

	renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true });
	camera = new THREE.OrthographicCamera( -10, 10, 10, -10, -1, 1 );
	scene = new THREE.Scene();

	scene.add(camera);

	renderer.setSize(width, height);
	
	window.addEventListener( 'resize', onResize, false );

	container.append(renderer.domElement);
}

// ************ CONTROLS ************
var showLoading = function(b) {
	if(b)
		$('#loading').show();
	else
		$('#loading').hide();
}

var updateTimeBar = function() {
	var maxTimeBarWidth = $('.clickable').width();
	var timeBarFilledWidth = animationTime/particleManager.maxTime * maxTimeBarWidth;
	if(timeBarFilledWidth > maxTimeBarWidth)
		timeBarFilledWidth = maxTimeBarWidth;
	$('.progress').width(timeBarFilledWidth);
	
	var timeString;
	if(particleManager.timeAsDate)
		timeString = new Date(animationTime + particleManager.startTime).toUTCString();
	else
		timeString = millisecToHHMMSS(animationTime);	//If data time starts from 0 or 1000 display it in seconds
	
	$("#time").text("Time: " + timeString)
}

var reset = function() {
	animationTime = 0;
	prevRealTime = new Date().getTime();
}

var startStop = function() {
	if(play)
		stop();
	else
		start();
}

var start = function() {
	if(!play && ready) {
		$('#startStop').html("&#10074; &#10074;");
		$("#startStop").css("fontSize", "70%");
		
		$('.progress').css('background', 'green');
		if(animationTime >= particleManager.maxTime)
			reset();

		prevRealTime = new Date().getTime();
		play = true;
	}
}

var stop = function() {
	$('#startStop').html("&#9658");
	$("#startStop").css("fontSize", "80%");
	
	$('.progress').css('background', 'yellow');
	play = false;
}

var slower = function() {
	timestep /= 2;
	$("#speed").html("Playback speed: " + timestep + "x");
	
	if(timestep <= 0.125)
		$('#slower').prop("disabled",true);
	
	$('#faster').prop("disabled",false);
}

var faster = function() {
	timestep *= 2;
	$("#speed").html("Playback speed: " + timestep + "x");
	
	if(timestep >= 2048)
		$('#faster').prop("disabled",true);
	
	$('#slower').prop("disabled",false);
}

// 0: normal
// 1: heatmap
var toggleHeatMap = function() {
	if(typeof(blendingMode) != 'number')
		blendingMode = 0;
	else
		blendingMode = 1 - blendingMode;	//flip between 0 and 1
	
	switch(blendingMode){
		case 0:
			mode = 1;
			material.uniforms[ 'heatmap' ].value = 1;
			material.blending = THREE.AdditiveBlending;
			break;
		case 1:
			mode = 0;
			material.uniforms[ 'heatmap' ].value = 0;
			material.blending = THREE.NormalBlending;
			break;
	}
}

var setMapProvider = function(a) {
	if(a == '1')
		localStorage.setItem("useOSM", 1)
	else
		localStorage.removeItem("useOSM")
	
	window.location.href = '';	//refresh page
}


// ************ EVENTS ************
var onResize = function( event ) {
	var width = $('#overlay').width();
	var height = $('#overlay').height();
	
	$('.clickable').height($('#buttons').height());
	$('.progress').height($('#buttons').height());
	
	renderer.setSize(width, height);
	
	var scale = $('#overlay').height()/20;
	if(material != undefined && material.uniforms != undefined)
		material.uniforms[ 'scale' ].value = scale;
}


// ************ MAP ************
var setupMap = function() {
	var gmap = new google.maps.Map(document.getElementById('gmap'), {
		disableDefaultUI: true,
		keyboardShortcuts: false,
		draggable: false,
		disableDoubleClickZoom: true,
		scrollwheel: false,
		streetViewControl: false
	});

	var gView = new ol.View({
		// make sure the view doesn't go beyond the 22 zoom levels of Google Maps
		maxZoom: 21
	});
	gView.on('change:center', function() {
		var center = ol.proj.transform(gView.getCenter(), 'EPSG:3857', 'EPSG:4326');
		gmap.setCenter(new google.maps.LatLng(center[1], center[0]));
	});
	gView.on('change:resolution', function() {
		gmap.setZoom(gView.getZoom());
	});

	gView.setCenter([0, 0]);
	gView.setZoom(2);
	
	osmView = new ol.View({
		center: [0, 0],
		zoom: 2
	});
	
	var olMapDiv = document.getElementById('map');
	
	var useOSM = localStorage.getItem("useOSM") == 1;
	
	map = new ol.Map({
		layers: useOSM ? [new ol.layer.Tile({preload: Infinity, source: new ol.source.OSM()})] : [],
		view: useOSM ? osmView : gView,
		loadTilesWhileInteracting: true,
		interactions: ol.interaction.defaults({
			dragPan: false,
			mouseWheelZoom: false
		}).extend([
			new ol.interaction.DragPan({kinetic: false}),
			new ol.interaction.MouseWheelZoom({duration: 0})
		]),
		target: olMapDiv
	});
	
	if(useOSM)
		document.getElementById("gmap").hidden=true;
	else
		gmap.controls[google.maps.ControlPosition.TOP_LEFT].push(olMapDiv);
		
}


fromProj = new ol.proj.Projection({ code: "EPSG:4326" });   // Transform from WGS 1984
toProj   = new ol.proj.Projection({ code: "EPSG:900913" }); // to Spherical Mercator Projection

var transf = function(lon, lat) {
	return ol.proj.transform([lat, lon], fromProj, toProj);
}

var millisecToHHMMSS = function (ms) {
    var sec_num = parseInt(ms/1000, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}