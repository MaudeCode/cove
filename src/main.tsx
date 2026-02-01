import { render } from "preact";
// Web fonts
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/opendyslexic/400.css";
import "@/styles/tailwind.css";
import { App } from "@/app";

render(<App />, document.querySelector("#app")!);
