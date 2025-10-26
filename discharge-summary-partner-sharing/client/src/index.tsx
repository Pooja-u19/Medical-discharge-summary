import ReactDOM from "react-dom/client";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import { MantineProvider, Loader, createTheme } from "@mantine/core";
import { LoaderProvider, LoggerProvider, ToastProvider } from "./contexts";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import RingLoader from "./components/common/RingLoader/RingLoader";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

const theme = createTheme({
  components: {
    Loader: Loader.extend({
      defaultProps: {
        loaders: { ...Loader.defaultLoaders, ring: RingLoader },
        type: "ring",
      },
    }),
  },
});

root.render(
  <MantineProvider theme={theme}>
    <LoaderProvider>
      <Notifications position="top-right" />
      <LoggerProvider>
        <ToastProvider>
          <Router>
            <App />
          </Router>
        </ToastProvider>
      </LoggerProvider>
    </LoaderProvider>
  </MantineProvider>
);

reportWebVitals();
