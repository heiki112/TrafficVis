var play = false;
var ready = false;
var mode = 0;

//time variables
var animationTime, maxAnimationTime;	//related to animation time
var prevRealTime, newRealTime, deltaRealTime; //variables for actual time
var timestep = 1; //speed

//"particle manager"
var particleManager;

//WebGL things
var loader, renderer, scene, camera, particleMesh, material;
var interleavedBuffer;

//Map variables
var map, extent;
var fromProj, toProj;

//time bar variables
var maxTimeBarWidth, newTimeBarWidth;

var init = function() {
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
		
		addData(this.files, 0);
	};
	
	setupTimeBar();
	setupMap();
	setupWebgl();
}

var addData = function(data, fileCounter) {
	if(fileCounter >= data.length) {
		startMainLoop();
		return;
	}
	
	var navigator = new FileNavigator(data[fileCounter]);

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
			addData(data, ++fileCounter);
		}
	});
}

var startMainLoop = function() {
	particleManager.createChunks();
	map.getView().fit([particleManager.minLon, particleManager.minLat, particleManager.maxLon, particleManager.maxLat], map.getSize());
	if(map.getView().getZoom() > 12)
		map.getView().setZoom(12);
	
	maxAnimationTime = particleManager.maxTime;
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
		newRealTime = new Date().getTime();
		deltaRealTime = newRealTime - prevRealTime;
		prevRealTime = newRealTime;
		animationTime += deltaRealTime*timestep;
		
		if(animationTime >= maxAnimationTime) {
			stop();
			animationTime = maxAnimationTime;
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
	extent = map.getView().calculateExtent(map.getSize());
	
	//Camera bounds
	camera.left = extent[0];
	camera.right = extent[2];
	camera.top = extent[3];
	camera.bottom = extent[1];
	camera.updateProjectionMatrix();
}

var createMesh = function(maxSize) {
	var geometry = new THREE.InstancedBufferGeometry();
	
	interleavedBuffer = new THREE.InterleavedBuffer( new Float32Array( maxSize ), 10 );
	
	geometry.addAttribute( 'position', new THREE.InterleavedBufferAttribute( interleavedBuffer, 3, 0 ) );
	geometry.addAttribute( 'positionNext', new THREE.InterleavedBufferAttribute( interleavedBuffer, 3, 3 ) );

	geometry.addAttribute( 'color', new THREE.InterleavedBufferAttribute( interleavedBuffer, 1, 6 ) );
	geometry.addAttribute( 'alpha', new THREE.InterleavedBufferAttribute( interleavedBuffer, 1, 7 ) );
	
	geometry.addAttribute( 'size', new THREE.InterleavedBufferAttribute( interleavedBuffer, 1, 8 ) );
	geometry.addAttribute( 'zValue', new THREE.InterleavedBufferAttribute( interleavedBuffer, 1, 9 ) );
	
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
	maxTimeBarWidth = $('.clickable').width();
	
	$('.clickable').bind('click', function (ev) {
		var $div = $(ev.target);

		var offset = $div.offset();
		var x = ev.clientX - offset.left;
		var factor = x/$('.clickable').width();
		if(factor < 0)
			factor = 0;
		else if(factor > 1)
			factor = 1;
		
		animationTime = factor * maxAnimationTime;
	});
}

var setupWebgl = function() {
	var vertexShader = $('#vertexShader')[0].textContent;
	var fragmentShader = $('#fragmentShader')[0].textContent;
	loader = new THREE.TextureLoader();
	
	material = new THREE.RawShaderMaterial({
		uniforms: {
			texture: { type: "t", value: loader.load( "images/spark1.png" ) },
			time: { type: 'f', value: 0.0 },
			scale: { type: 'f', value: $('#overlay').height()/20 },
			mode: { type: 'i', value: 0 }
		},
		depthTest: false,
		transparent: true,
		vertexShader: vertexShader,
		fragmentShader: fragmentShader
	});
	
	var width = $('#overlay').width();
	var height = $('#overlay').height();

	var $container = $('#overlay');

	renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true });
	camera = new THREE.OrthographicCamera( -10, 10, 10, -10, -1, 1 );
	scene = new THREE.Scene();

	scene.add(camera);

	renderer.setSize(width, height);
	
	window.addEventListener( 'resize', onResize, false );

	$container.append(renderer.domElement);
}

// ************ CONTROLS ************
var showLoading = function(b) {
	if(b)
		$('#loading').show();
	else
		$('#loading').hide();
}

var updateTimeBar = function() {
	newTimeBarWidth = animationTime/maxAnimationTime * maxTimeBarWidth;
	if(newTimeBarWidth > maxTimeBarWidth)
		newTimeBarWidth = maxTimeBarWidth;
	$('.progress').width(newTimeBarWidth);
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
		if(animationTime >= maxAnimationTime)
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
var toggleMode = function() {
	switch(mode){
		case 0:
			mode = 1;
			material.uniforms[ 'mode' ].value = 1;
			material.blending = THREE.AdditiveBlending;
			break;
		case 1:
			mode = 0;
			material.uniforms[ 'mode' ].value = 0;
			material.blending = THREE.NormalBlending;
			break;
	}
}


// ************ EVENTS ************
var onResize = function( event ) {
	var width = $('#overlay').width();
	var height = $('#overlay').height();
	
	$('.clickable').height($('#buttons').height());
	$('.progress').height($('#buttons').height());
	
	renderer.setSize(width, height);
	maxTimeBarWidth = $('.clickable').width();
	
	var scale = $('#overlay').height()/20;
	if(material != undefined && material.uniforms != undefined)
		material.uniforms[ 'scale' ].value = scale;
}


// ************ MAP ************
var setupMap = function() {
	fromProj = new ol.proj.Projection({ code: "EPSG:4326" });   // Transform from WGS 1984
    toProj   = new ol.proj.Projection({ code: "EPSG:900913" }); // to Spherical Mercator Projection
	
	map = new ol.Map({
		layers: [
			new ol.layer.Tile({
				preload: Infinity,
				source: new ol.source.OSM()
			})
		],
		view: new ol.View({
			center: [0, 0],
			zoom: 2
		}),
		loadTilesWhileInteracting: true,
		interactions: ol.interaction.defaults({
			dragPan: false,
			mouseWheelZoom: false
		}).extend([
			new ol.interaction.DragPan({kinetic: false}),
			new ol.interaction.MouseWheelZoom({duration: 0})
		]),
		target: 'map'
	});
}

var transf = function(lon, lat) {
	return ol.proj.transform([lat, lon], fromProj, toProj);
}
