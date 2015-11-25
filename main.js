var play = false;
var ready = false;
var mouse;

var prevTime = 0;
var time = 0;
var timestep = 0.001;
var sincePrevTick = 0;

var map, mainLayer;
var fromProj, toProj;

var objects = [];

var renderer, scene, camera, particleSystem, material;
var vertexShader, fragmentShader;
var lonLats = [];

function init() {
	$('.clickable').height($('#buttons').height());
	$('.progress').height($('#buttons').height());
	
	$('.clickable').bind('click', function (ev) {
		var $div = $(ev.target);

		var offset = $div.offset();
		var x = ev.clientX - offset.left;
		$('.progress').width(x);
		
		if(objects.length == 0)
			return;
		
		var percentage = x/$('.clickable').width();
		if(percentage < 0)
			percentage = 0;
		else if(percentage > 1)
			percentage = 1;
		
		setTime(percentage * objects[0].coords.length);
	});
	
	vertexShader = $('#vertexShader')[0].textContent;
	fragmentShader = $('#fragmentShader')[0].textContent;
	
	setupMap();
	setupOverlay();
	
	document.getElementById('file').onchange = function(){
		var file = this.files[0];

		var reader = new FileReader();
		reader.onload = function(progressEvent){
			ready = false;
			objects = [];
			// By lines
			var id;
			var object;
			var lines = this.result.split('\n');
			for(var line = 0; line < lines.length-1; line++){
				var l = lines[line].split(";");
				if(l[0] !=  id){
					if (typeof object !== 'undefined') {
						objects.push(object);
					}
					object = {};
					id = object.id = l[0];
					object.coords = [];
				}
				var lat = parseFloat(l[2]);
				var lon = parseFloat(l[3]);
				object.coords.push(transf([lon, lat]));
			}
			
			createGeometry();
			
			ready = true;
			step();
		};
		reader.readAsText(file);
	};
}

var step = function() {
	var extent = map.getView().calculateExtent(map.getSize());
	//var zoom = map.getView().getZoom();
	
	camera.left = extent[0];
	camera.right = extent[2];
	camera.top = extent[3];
	camera.bottom = extent[1];
	camera.updateProjectionMatrix();
	
	//var scale = (camera.right - camera.left)/200;
	var scale = $('#overlay').height()/20;
	material.uniforms[ 'scale' ].value = scale;
	
	if(time >= objects[0].coords.length){
		play = false;
	}
	
	if(play && ready){
		var t = new Date().getTime();
		var deltaTime = t - prevTime;
		
		var flooredTime = Math.floor(time);
		if(time - sincePrevTick > 1.0) {
			//console.log(flooredTime);
			sincePrevTick = Math.floor(time);
			
			var flip = material.uniforms[ 'flip' ].value;
			if(flip == 1.0){
				particleSystem.geometry.attributes.lonLat1.array = lonLats[flooredTime+1];
				particleSystem.geometry.attributes.lonLat1.needsUpdate = true;
			} else {
				particleSystem.geometry.attributes.lonLat2.array = lonLats[flooredTime+1];
				particleSystem.geometry.attributes.lonLat2.needsUpdate = true;
			}
			
			material.uniforms[ 'flip' ].value = -flip;
			
			//Timebar
			$('.progress').width(flooredTime/objects[0].coords.length * $('.clickable').width());
		}
		material.uniforms[ 'timeInterpolate' ].value = time - sincePrevTick;
		
		prevTime = t;
		sincePrevTick = Math.floor(flooredTime);
		time += deltaTime*timestep;
	}
	
	renderer.render(scene, camera);
	window.requestAnimationFrame(step);
}

var createGeometry = function() {
	//Creating particleSystem: geometry + material
	var particleCount = objects.length;
	
	var geometry = new THREE.BufferGeometry();
	
	for ( var i = 0; i < objects[0].coords.length; i ++ ) {
		var lonLat = new Float32Array( particleCount * 2 );
		
		for ( var j = 0; j < lonLat.length; j += 2 ) {
			var coords = objects[j/2].coords[i];
			
			var lon = coords[0];
			var lat = coords[1];
			
			lonLat[ j ]     = lon;
			lonLat[ j + 1 ] = lat;
		}
		
		lonLats.push(lonLat);
	}
	
	geometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( particleCount ), 1 ) );	//Unused
	geometry.addAttribute( 'lonLat1', new THREE.BufferAttribute( lonLats[0], 2 ) );
	geometry.addAttribute( 'lonLat2', new THREE.BufferAttribute( lonLats[1] === undefined ? lonLats[0] : lonLats[1], 2 ) );
	
	material = new THREE.ShaderMaterial({
		uniforms: {
			texture: { type: "t", value: THREE.ImageUtils.loadTexture( "/textures/spark1.png" ) },
			timeInterpolate: { type: 'f', value: 0.0 },
			scale: { type: 'f', value: 1.0 },
			flip: { type: 'f', value: 1.0 }
		},
		blending: THREE.AdditiveBlending,
		depthTest: false,
		transparent: true,
		vertexShader: vertexShader,
		fragmentShader: fragmentShader
	});
	
	particleSystem = new THREE.Points( geometry, material );
	particleSystem.frustumCulled = false;
	scene.add( particleSystem );
}

var setupOverlay = function() {
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
var setTime = function(newTime) {
	play = false;
	particleSystem.geometry.attributes.lonLat1.array = lonLats[newTime];
	particleSystem.geometry.attributes.lonLat1.needsUpdate = true;
	particleSystem.geometry.attributes.lonLat2.array = lonLats[newTime+1];
	particleSystem.geometry.attributes.lonLat2.needsUpdate = true;
	time = newTime;
	material.uniforms[ 'flip' ].value = 1.0;
	play = true;
}

var reset = function() {
	setTime(0);
}

var start = function() {
	if(!play && ready) {
		if(time >= objects[0].coords.length)
			reset();

		prevTime = new Date().getTime();
		play = true;
	}
}

var stop = function() {
	play = false;
}

var slower = function() {
	timestep /= 2;
}

var faster = function() {
	timestep *= 2;
}


// ************ EVENTS ************
var onMouseMove = function( event ) {
	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;		

}

var onResize = function( event ) {
	var width = $('#overlay').width();
	var height = $('#overlay').height();
	renderer.setSize(width, height);
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
