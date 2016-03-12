//********** ParticleManager **********
var ParticleManager = function() {
	var self = this;
	
	this.chunkTime = 20000; //default chunk time size, in milliseconds
	
	this.ready = false;
	this.maxTime = 0;
	this.minLat = Number.MAX_SAFE_INTEGER;
	this.minLon = Number.MAX_SAFE_INTEGER;
	this.maxLat = Number.MIN_SAFE_INTEGER;
	this.maxLon = Number.MIN_SAFE_INTEGER;
	this.maxChunkSize = 0;
	this.particles = [];
	
	//position-time data chunks, lists of Float32Array that are given into interleavedBuffer
	this.chunks = [];
	
	//"Public" functions
	ParticleManager.prototype.addData = function(data) {
		Array.prototype.push.apply(self.particles, data.particles);
	}
	
	ParticleManager.prototype.createChunks = function() {
		firstPass(0);
	}
	
	ParticleManager.prototype.getChunk = function(time) {
		return this.chunks[Math.floor(time/self.chunkTime)];
	}
	
	
	//"Private functions"
	var firstPass = function(particleId) {
		var idLimit = particleId + 10000;
		if(idLimit > self.particles.length)
			idLimit = self.particles.length;
		
		for(var i = particleId; i < idLimit; i++) {
			var particle = self.particles[i];
			
			var sorted = true;
			for(var j = 0; j < particle.coordTimes.length; j++){
				var lonLat = transf([particle.coordTimes[j].lat, particle.coordTimes[j].lon]);
				particle.coordTimes[j].lon = lonLat[0];
				particle.coordTimes[j].lat = lonLat[1];
				
				//max time
				if(particle.coordTimes[j].time > self.maxTime)
					self.maxTime = particle.coordTimes[j].time;
				
				//map bounds
				if(particle.coordTimes[j].lat < self.minLat)
					self.minLat = particle.coordTimes[j].lat;
				if(particle.coordTimes[j].lat > self.maxLat)
					self.maxLat = particle.coordTimes[j].lat;
				if(particle.coordTimes[j].lon < self.minLon)
					self.minLon = particle.coordTimes[j].lon;
				if(particle.coordTimes[j].lon > self.maxLon)
					self.maxLon = particle.coordTimes[j].lon;
				
				if(j > 0 && particle.coordTimes[j-1].time > particle.coordTimes[j].time)
					sorted = false;
			}
			if(!sorted)
				particle.coordTimes.sort( function(ct1, ct2) { return ct1.time - ct2.time } );
		}
		setTimeout(function() {
			if(idLimit < self.particles.length)
				firstPass(idLimit);
			else
				createChunksInner(0);
		}, 0)
	}
	
	var createChunksInner = function(chunkCounter) {
		if(chunkCounter*self.chunkTime > self.maxTime) {
			self.ready = true;
			return;
		}
		
		var chunkArray = [];
		for(var i = 0; i < self.particles.length; i++) {
			var particle = self.particles[i];
			var slot = searchTimeSlot(i, chunkCounter*self.chunkTime);
			if(typeof(slot) != 'undefined') {
				while(slot < particle.coordTimes.length-1 && particle.coordTimes[slot].time < (chunkCounter+1)*self.chunkTime) {
					chunkArray.push(particle.coordTimes[slot].lon);
					chunkArray.push(particle.coordTimes[slot].lat);
					chunkArray.push(particle.coordTimes[slot].time);
					
					chunkArray.push(particle.coordTimes[slot+1].lon);
					chunkArray.push(particle.coordTimes[slot+1].lat);
					chunkArray.push(particle.coordTimes[slot+1].time);
					
					chunkArray.push(packColor(particle.color));

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
		if(typeof(self.particles[id].coordTimes[0]) == 'undefined' || self.particles[id].coordTimes[0].time > time){
			return undefined;
		}
		
		//binary search
		var low = 0;
        var high = self.particles[id].coordTimes.length - 1;
		var middle = Math.floor((high + low)/2);

		while(low < high){
			if(time < self.particles[id].coordTimes[middle].time)
				high = middle;
			else
				low = middle+1;
			
			middle = Math.floor((high + low)/2);
		}
		
		if(self.particles[id].coordTimes[middle].time > time)
			middle--;
		
		return middle;
	}
	
	var packColor = function(color) {
		return color.r + color.g * 256.0 + color.b * 256.0 * 256.0;
	}
	
}