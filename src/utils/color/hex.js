import Rgb from "./rgb";
export default class Hex {
	r = 0;
	g = 0;
	b = 0;
	a = 1;
	constructor(r, g, b, a = 1) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	}
	static fromRgb(rgb) {
		const { r, g, b, a } = rgb;
		return new Hex(r, g, b, a * 255);
	}
	toString(alpha) {
		let r = this.r.toString(16);
		let g = this.g.toString(16);
		let b = this.b.toString(16);
		let a = this.a.toString(16);
		if (r.length === 1) r = `0${r}`;
		if (g.length === 1) g = `0${g}`;
		if (b.length === 1) b = `0${b}`;
		if (a.length === 1) a = `0${a}`;
		const hex = () => `#${r}${g}${b}`.toUpperCase();
		const hexA = () => `#${r}${g}${b}${a}`.toUpperCase();
		if (alpha === undefined) {
			return this.a === 255 ? hex() : hexA();
		}
		return alpha ? hexA() : hex();
	}
	get rgb() {
		return new Rgb(this.r, this.g, this.b, this.a);
	}
}
