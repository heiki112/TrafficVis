var play = false;
var ready = false;

//time variables
var animationTime, maxAnimationTime, currentChunkTime;	//related to animation time
var prevRealTime, newRealTime, deltaRealTime; //variables for actual time
var timestep = 1; //speed

//"particle manager"
var particleManager;

//WebGL things
var loader, renderer, scene, camera, particleMesh, material;
var vertexShader, fragmentShader;

//Map variables
var map, extent;
var fromProj, toProj;

//mouse coordinates, currently unused
//var mouse;

//time bar variables
var maxTimeBarWidth, newTimeBarWidth;

var init = function() {
	document.getElementById('file').onchange = function(){
		if(typeof this.files[0] === 'undefined'){
			return;
		}
		showLoading(true);
		if(typeof particleMesh != 'undefined'){
			scene.remove(particleMesh);
		}
		if(typeof particleManager != 'undefined'){
			particleManager.ready = false;
		}
		ready = false;
		stop();
		reset();
		updateTimeBar();
		
		var reader = new FileReader();
		reader.onload = function(e) {
			particleManager = new ParticleManager(JSON.parse(reader.result));
			particleManager.createChunks();
			maxAnimationTime = particleManager.maxTime;
			
			mainLoop();
		}
		
		
		reader.readAsText(this.files[0])
		return;
	};
	
	setupTimeBar();
	setupMap();
	setupOverlay();
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
	
	if(animationTime >= currentChunkTime + ParticleManager.getChunkTime() || animationTime < currentChunkTime) {
		getDataChunk();
	}
	material.uniforms['time'].value = animationTime;
	updateTimeBar();
	
	renderer.render(scene, camera);
	window.requestAnimationFrame(mainLoop);
}

var getDataChunk = function() {
	var startChunk = particleManager.getStartChunk(animationTime);
	var endChunk = particleManager.getEndChunk(animationTime);
	
	particleMesh.geometry.attributes.posTimeStart.array.set(startChunk);
	particleMesh.geometry.attributes.posTimeStart.array.fill(0, startChunk.length);
	
	particleMesh.geometry.attributes.posTimeEnd.array.set(endChunk);
	particleMesh.geometry.attributes.posTimeEnd.array.fill(0, endChunk.length);
	
	particleMesh.geometry.attributes.posTimeStart.needsUpdate = true;
	particleMesh.geometry.attributes.posTimeEnd.needsUpdate = true;
	
	currentChunkTime = Math.floor(animationTime/ParticleManager.getChunkTime())*ParticleManager.getChunkTime();
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
	var geometry = new THREE.BufferGeometry();
	
	geometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( maxSize/3 ), 1 ) );
	geometry.addAttribute( 'posTimeStart', new THREE.BufferAttribute( new Float32Array( maxSize ), 3 ) );
	geometry.addAttribute( 'posTimeEnd', new THREE.BufferAttribute( new Float32Array( maxSize ), 3 ) );
	
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

var setupOverlay = function() {
	vertexShader = $('#vertexShader')[0].textContent;
	fragmentShader = $('#fragmentShader')[0].textContent;
	loader = new THREE.TextureLoader();
	
	material = new THREE.ShaderMaterial({
		uniforms: {
			texture: { type: "t", value: loader.load( "images/spark1.png" ) },
			time: { type: 'f', value: 0.0 },
			scale: { type: 'f', value: $('#overlay').height()/20 }
		},
		blending: THREE.AdditiveBlending,
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
	
	//mouse = new THREE.Vector2();
	//window.addEventListener( 'mousemove', onMouseMove, false );
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


// ************ EVENTS ************
/*var onMouseMove = function( event ) {
	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;		

}*/

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
	map.getView().fit(transf([21.781, 57.521, 28.883, 59.983]), map.getSize());
}

var transf = function(a) {
	if(a.length == 2) {
		return ol.proj.transform([a[0], a[1]], fromProj, toProj);
	} else if(a.length == 4) {
		return ol.proj.transformExtent([a[0], a[1], a[2], a[3]], fromProj, toProj);
	}
}

var transfInverse = function(a) {
	if(a.length == 2) {
		return ol.proj.transform([a[0], a[1]], toProj, fromProj);
	} else if(a.length == 4) {
		return ol.proj.transformExtent([a[0], a[1], a[2], a[3]], toProj, fromProj);
	}
}