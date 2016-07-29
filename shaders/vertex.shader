
precision highp float;
precision mediump int;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

attribute vec3 position;		//position-time: lon, lat, time
attribute vec3 positionNext;	//position-time: lon, lat, time
attribute float color;
attribute float alpha;
attribute float size;
attribute float zValue;

uniform float time;
uniform float scale;
uniform int heatmap;

varying vec3 unpackedColor;
varying float alphaVar;
varying float modeVar;

const vec2 zero = vec2(0.0, 0.0);
const vec4 outOfBounds = vec4(2.0, 0.0, 0.0, 1.0);

vec3 unpackColor(float f) {
	vec3 color;
	color.b = floor(f / 256.0 / 256.0);
	color.g = floor((f - color.b * 256.0 * 256.0) / 256.0);
	color.r = floor(f - color.b * 256.0 * 256.0 - color.g * 256.0);
	// now we have a vec3 with the 3 components in range [0..256]. Let's normalize it!
	return color / 256.0;
}

void main() {
	if(time < position.z || time > positionNext.z || position.xy == zero || positionNext.xy == zero) {
		gl_Position = outOfBounds;
		return;
	}
	unpackedColor = unpackColor(color);
	alphaVar = alpha;
	
	if(heatmap == 0){
		modeVar = 0.0;
		gl_PointSize = (scale * 0.35) * size;
	}
	else {
		modeVar = 1.0;
		gl_PointSize = scale * size;
	}
	
	float timeDiff = positionNext.z - position.z;
	if(timeDiff == 0.0){
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, 0.0, 1.0);
	}
	else{
		float interpolate = (time - position.z)/(timeDiff);
		vec3 mapPos = vec3(mix(position.x, positionNext.x, interpolate), mix(position.y, positionNext.y, interpolate), zValue);
		gl_Position = projectionMatrix * modelViewMatrix * vec4(mapPos, 1.0);
	}
}
