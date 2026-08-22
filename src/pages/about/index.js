function About() {
	import("./about").then((res) => {
		res.default();
	});
}
export default About;
