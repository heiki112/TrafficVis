//********** ParticleManager **********
var ParticleManager = function() {
	var self = this;
	
	this.chunkTime = 30000; //default chunk time size, in milliseconds
	this.currentChunkTime;
	
	this.ready = false;
	this.startTime = Number.MAX_SAFE_INTEGER;
	this.maxTime = 0;
	this.minLat = Number.MAX_SAFE_INTEGER;
	this.minLon = Number.MAX_SAFE_INTEGER;
	this.maxLat = Number.MIN_SAFE_INTEGER;
	this.maxLon = Number.MIN_SAFE_INTEGER;
	this.maxChunkSize = 0;
	this.particles = [];
	this.particleMap = {};
	
	//position-time data chunks, lists of Float32Array that are given into interleavedBuffer
	this.chunks = [];
	
	//"Public" functions
	ParticleManager.prototype.addData = function(data) {
		var obj;
		try {
			obj = JSON.parse(data.toLowerCase());
		}
		catch(err) { console.log(err); }
		if(obj){
			if(typeof(obj.lat) != 'undefined') {
				var id = obj.id.toString();
				delete obj.id;
				if(typeof(self.particleMap[id]) == 'undefined') {
					self.particles.push({coordTimes: []});
					self.particleMap[id] = self.particles[self.particles.length - 1];
				}
				
				var lonLat = transf(obj.lon, obj.lat);
				obj.lon = lonLat[0];
				obj.lat = lonLat[1];
				
				//max time
				if(obj.t > self.maxTime)
					self.maxTime = obj.t;
				//start time
				if(obj.t < self.startTime)
					self.startTime = obj.t;
				
				//map bounds
				if(obj.lat < self.minLat)
					self.minLat = obj.lat;
				if(obj.lat > self.maxLat)
					self.maxLat = obj.lat;
				if(obj.lon < self.minLon)
					self.minLon = obj.lon;
				if(obj.lon > self.maxLon)
					self.maxLon = obj.lon;
				
				self.particleMap[id].coordTimes.push(obj);
			}
			else {
				var id = obj.id.toString();
				obj.id = id;
				if(typeof(self.particleMap[id]) == 'undefined') {
					self.particles.push({coordTimes: []});
					self.particleMap[id] = self.particles[self.particles.length - 1];
				}
				
				self.particleMap[id].col = obj.c || {
					r: 230,
					g: 50,
					b: 0
				};
				self.particleMap[id].a = obj.a || 1.0;
				
				self.particleMap[id].s = obj.s || 1.0;
				self.particleMap[id].z = obj.z || 0.0;
				self.particleMap[id].m = obj.m || 0;
			}
		}
	}
	
	ParticleManager.prototype.createChunks = function() {
		self.maxTime -= self.startTime;
		firstPass(0);
	}
	
	ParticleManager.prototype.isChunkOutdated = function(time) {
		return (time >= self.currentChunkTime + self.chunkTime || time < self.currentChunkTime);
	}
	
	
	
	ParticleManager.prototype.getChunk = function(time) {
		self.currentChunkTime = Math.floor(time/self.chunkTime) * self.chunkTime;
		return this.chunks[Math.floor(time/self.chunkTime)];
	}
	
	
	//"Private functions"
	var firstPass = function(particleId) {
		var idLimit = particleId + 10000;
		
		console.log('ParticleManager firstPass: ', idLimit);
		
		if(idLimit > self.particles.length)
			idLimit = self.particles.length;
		
		for(var i = particleId; i < idLimit; i++) {	//Check if particle coordinate-time array is sorted, sort if needed
			var particle = self.particles[i];
			
			var sorted = true;
			for(var j = 0; j < particle.coordTimes.length; j++){
				particle.coordTimes[j].t -= self.startTime;
				if(j > 0 && particle.coordTimes[j-1].t > particle.coordTimes[j].t)
					sorted = false;
			}
			if(!sorted)
				particle.coordTimes.sort( function(ct1, ct2) { return ct1.t - ct2.t } );
		}
		
		self.particles.sort( function(p1, p2) { return p1.z - p2.z } );	//Sort particles based on Z-value for correct rendering (lower Z-value particles in the beginning -> rendered first)
		
		setTimeout(function() {
			if(idLimit < self.particles.length)
				firstPass(idLimit);
			else {
				console.log('Total time chunks to be made: ', Math.ceil(self.maxTime/self.chunkTime));
				console.log('ChunkTime(s): ', self.chunkTime / 1000);
				createChunksInner(0);
			}
		}, 0)
	}
	
	var createChunksInner = function(chunkCounter) {
		console.log('ParticleManager createChunksInner: ', chunkCounter);
		
		if(chunkCounter*self.chunkTime > self.maxTime) {
			self.ready = true;
			return;
		}
		
		var chunkArray = [];
		for(var i = 0; i < self.particles.length; i++) {
			var particle = self.particles[i];
			
			var slot = searchTimeSlot(i, chunkCounter*self.chunkTime);
			if(typeof(slot) != 'undefined') {
				while(slot < particle.coordTimes.length-1 && particle.coordTimes[slot].t < (chunkCounter+1)*self.chunkTime) {
					chunkArray.push(particle.coordTimes[slot].lon);
					chunkArray.push(particle.coordTimes[slot].lat);
					chunkArray.push(particle.coordTimes[slot].t);
					
					chunkArray.push(particle.coordTimes[slot+1].lon);
					chunkArray.push(particle.coordTimes[slot+1].lat);
					chunkArray.push(particle.coordTimes[slot+1].t);
					
					chunkArray.push(packColor(particle.col));
					chunkArray.push(particle.a);
					
					chunkArray.push(particle.s);
					chunkArray.push(particle.z);
					chunkArray.push(particle.m);

					slot++;
				}
			}
		}

		
		var arrSize = chunkArray.length;
		if(arrSize > self.maxChunkSize)
			self.maxChunkSize = arrSize;
		
		var chunk = new Float32Array(arrSize);
		
		for(var i = 0; i < arrSize; i++) {
			chunk[i] = chunkArray[i];
		}
		
		self.chunks.push(chunk);
		
		setTimeout(function() {
			createChunksInner(++chunkCounter);
		}, 0)
	}
	
	var searchTimeSlot = function(id, time) {
		if(typeof(self.particles[id].coordTimes[0]) == 'undefined' || self.particles[id].coordTimes[0].t > time){
			return undefined;
		}
		
		//binary search
		var low = 0;
        var high = self.particles[id].coordTimes.length - 1;
		var middle = Math.floor((high + low)/2);

		while(low < high){
			if(time < self.particles[id].coordTimes[middle].t)
				high = middle;
			else
				low = middle+1;
			
			middle = Math.floor((high + low)/2);
		}
		
		if(self.particles[id].coordTimes[middle].t > time)
			middle--;
		
		return middle;
	}
	
	var packColor = function(color) {
		return color.r + color.g * 256.0 + color.b * 256.0 * 256.0;
	}
	
}