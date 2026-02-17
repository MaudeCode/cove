import { render } from "preact";
import "@/styles/tailwind.css";
import { App } from "@/app";

render(<App />, document.querySelector("#app")!);
