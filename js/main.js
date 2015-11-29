var play = false;
var ready = false;
var ended = false;
var mouse;

var time, prevT;
var timestep = 1;
var updater;

var map, mainLayer;
var fromProj, toProj;

var particleObjects;

var loader, renderer, scene, camera, particleMesh, material;
var vertexShader, fragmentShader;

function init() {
	$('.clickable').height($('#buttons').height());
	$('.progress').height($('#buttons').height());
	
	$('.clickable').bind('click', function (ev) {
		var $div = $(ev.target);

		var offset = $div.offset();
		var x = ev.clientX - offset.left;
		var factor = x/$('.clickable').width();
		if(factor < 0)
			factor = 0;
		else if(factor > 1)
			factor = 1;
		
		setTime(factor);
	});
	
	setupMap();
	setupOverlay();
	
	document.getElementById('file').onchange = function(){
		ready = false;
		showLoading(true);
		var file = this.files[0];
			
		updater = new Updater();
		particleObjects = {};
		
		var skipFirst = false;
		var nameSlot = 0;
		var timeSlot = 1;
		var latSlot = 2;
		var lonSlot = 3;
		
		var navigator = new FileNavigator(file);
		navigator.readSomeLines(0, function linesReadHandler(err, index, lines, eof, progress) {
			// Error happened
			if (err) return; 
			
			// Reading lines
			for (var i = skipFirst ? 1 : 0; i < lines.length; i++) {
				if(lines[i].trim() == "")
					continue;
				
				var l = lines[i].split(";");
				var nameValue = l[nameSlot];
				var latValue = parseFloat(l[latSlot]);
				var lonValue = parseFloat(l[lonSlot]);
				var timeValue;
				if($.isNumeric(l[timeSlot]))
					timeValue = parseFloat(l[timeSlot]) * 1000;
				else
					timeValue = Date.parse(l[timeSlot]);
				
				var particle;
				if(typeof particleObjects[nameValue] === 'undefined'){
					particle = new Particle(nameValue);
					particleObjects[nameValue] = particle;
				}
				else {
					particle = particleObjects[nameValue];
				}
				var coordTime = new CoordinateTime(transf([lonValue, latValue]), timeValue);
				particle.coords.push(coordTime);
				updater.add(nameValue, timeValue);
			}
			
			// End of file
			if (eof) {
				updater.prepare();
				createGeometry();
				reset();
				
				ready = true;
				showLoading(false);
				step();
				return;
			}

			// Reading next chunk, adding number of lines read to first line in current chunk
			navigator.readSomeLines(index + lines.length, linesReadHandler);
		});
	};
}

var step = function() {
	if(!ready){
		return;
	}
	
	var extent = map.getView().calculateExtent(map.getSize());
	
	//Camera bounds
	camera.left = extent[0];
	camera.right = extent[2];
	camera.top = extent[3];
	camera.bottom = extent[1];
	camera.updateProjectionMatrix();
	
	var currentT = new Date().getTime();
	var deltaTime = currentT - prevT;
	prevT = currentT;
	if(play) {
		time += deltaTime*timestep;
		material.uniforms[ 'time' ].value = time;
		var updates = updater.get(time);
		if(typeof updates === 'undefined'){
			ended = true;
			stop();
		} else {
			for(var i = 0; i < updates.length; i++) {
				var particle = particleObjects[updates[i]];
				var id = particle.id;
				particleMesh.geometry.attributes.posTimeStart.array[id*3] = particleMesh.geometry.attributes.posTimeEnd.array[id*3];
				particleMesh.geometry.attributes.posTimeStart.array[id*3+1] = particleMesh.geometry.attributes.posTimeEnd.array[id*3+1];
				particleMesh.geometry.attributes.posTimeStart.array[id*3+2] = particleMesh.geometry.attributes.posTimeEnd.array[id*3+2];
				
				var newPosTime = particle.getNextCoordTime();
				if(typeof newPosTime != 'undefined'){
					particleMesh.geometry.attributes.posTimeEnd.array[id*3] = newPosTime.lon;
					particleMesh.geometry.attributes.posTimeEnd.array[id*3+1] = newPosTime.lat;
					particleMesh.geometry.attributes.posTimeEnd.array[id*3+2] = newPosTime.time;
				}
			}
			particleMesh.geometry.attributes.posTimeStart.needsUpdate = true;
			particleMesh.geometry.attributes.posTimeEnd.needsUpdate = true;
		}
		
		setTimeBar();
	}
	
	renderer.render(scene, camera);
	window.requestAnimationFrame(step);
}

var setTime = function(factor) {
	ended = false;
	var resume = play;
	if(resume)
		stop();
	
	showLoading(true);
	time = updater.set(factor);
	for(var p in particleObjects){
		var particle = particleObjects[p];
		var id = particle.id;
		particle.setTime(time);
		if(!particle.visible) {
			particleMesh.geometry.attributes.posTimeStart.array[id*3] = particleMesh.geometry.attributes.posTimeEnd.array[id*3] = 0;
			particleMesh.geometry.attributes.posTimeStart.array[id*3+1] = particleMesh.geometry.attributes.posTimeEnd.array[id*3+1] = 0;
			particleMesh.geometry.attributes.posTimeStart.array[id*3+2] = particleMesh.geometry.attributes.posTimeEnd.array[id*3+2] = 0;
			continue;
		}
		var currentPos = particle.getThisCoordTime();
		particleMesh.geometry.attributes.posTimeStart.array[id*3] = currentPos.lon;
		particleMesh.geometry.attributes.posTimeStart.array[id*3+1] = currentPos.lat;
		particleMesh.geometry.attributes.posTimeStart.array[id*3+2] = currentPos.time;
		
		var nextPos = particle.getNextCoordTime();
		if(typeof nextPos === 'undefined')
			nextPos = currentPos;
		particleMesh.geometry.attributes.posTimeEnd.array[id*3] = nextPos.lon;
		particleMesh.geometry.attributes.posTimeEnd.array[id*3+1] = nextPos.lat;
		particleMesh.geometry.attributes.posTimeEnd.array[id*3+2] = nextPos.time;
	}
	particleMesh.geometry.attributes.posTimeStart.needsUpdate = true;
	particleMesh.geometry.attributes.posTimeEnd.needsUpdate = true;
	
	showLoading(false);
	material.uniforms[ 'time' ].value = time;
	setTimeBar();
	if(resume)
		start();
}

var createGeometry = function() {
	//Creating particleMesh: geometry + material
	
	var geometry = new THREE.BufferGeometry();
	
	geometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( Particle.count() ), 1 ) );	//Unused
	geometry.addAttribute( 'posTimeStart', new THREE.BufferAttribute( new Float32Array( Particle.count()*3 ), 3 ) );
	geometry.addAttribute( 'posTimeEnd', new THREE.BufferAttribute( new Float32Array( Particle.count()*3 ), 3 ) );
	
	if(typeof particleMesh != 'undefined'){
		scene.remove(particleMesh);
	}
	particleMesh = new THREE.Points( geometry, material );
	particleMesh.frustumCulled = false;
	scene.add( particleMesh );
}

var setupOverlay = function() {
	vertexShader = $('#vertexShader')[0].textContent;
	fragmentShader = $('#fragmentShader')[0].textContent;
	loader = new THREE.TextureLoader();
	
	material = new THREE.ShaderMaterial({
		uniforms: {
			texture: { type: "t", value: loader.load( "/images/spark1.png" ) },
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
	
	mouse = new THREE.Vector2();
	window.addEventListener( 'mousemove', onMouseMove, false );
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

var setTimeBar = function() {
	$('.progress').width((time-updater.minTime())/(updater.maxTime()-updater.minTime()) * $('.clickable').width());
}

var reset = function() {
	stop();
	setTime(0);
	$('.progress').width(0);
	prevT = new Date().getTime();
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
		if(ended)
			reset();

		prevT = new Date().getTime();
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
var onMouseMove = function( event ) {
	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;		

}

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
	fromProj = new ol.proj.Projection({ code: "EPSG:4326" });   // Transform from WGS 1984
    toProj   = new ol.proj.Projection({ code: "EPSG:900913" }); // to Spherical Mercator Projection
	
	map = new ol.Map({
	  layers: [
		mainLayer = new ol.layer.Tile({
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