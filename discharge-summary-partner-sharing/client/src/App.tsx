import "./App.css";
import { Suspense, lazy, useEffect } from "react";
import { useLoader } from "./hooks/useLoader";
import { useToast } from "./hooks/useToast";
import { setupInterceptors } from "./api/axiosConfig";
import { Route, Routes } from "react-router-dom";
import { useLogger } from "./hooks";
import LoadingFallback from "./components/common/LoadingFallback/LoadingFallback";
import { LogLevel } from "./enums";
import { createObjectStore, openDatabase } from "./utils/indexDBUtils";
import { environment } from "./config/environment";

const Header = lazy(() => import("./components/common/Header/Header"));
const RequestsManagement = lazy(
  () => import("./components/pages/Admin/RequestsManagement/RequestsManagement")
);
const DocumentViewer = lazy(
  () => import("./components/pages/Admin/RequestsManagement/DocumentViewer/DocumentViewer")
);
const WelcomePage = lazy(() => import("./components/auth/WelcomePage"));
const LoginPage = lazy(() => import("./components/auth/LoginPage"));
const SignUpPage = lazy(() => import("./components/auth/SignUpPage"));
const ProtectedRoute = lazy(() => import("./components/auth/ProtectedRoute"));

const App = () => {
  const { showLoader, hideLoader } = useLoader();
  const { showToast } = useToast();
  const { setLogLevel, log } = useLogger();

  setLogLevel(LogLevel.INFO);
  setupInterceptors(showLoader, hideLoader, showToast, log);

  const initDB = async () => {
    await openDatabase(environment.indexedDBName, 1, async (db) => {
      await createObjectStore(db, environment.indexedDBStoreName, "requestId", [
        { name: "requestId", keyPath: "requestId" },
      ]);
    });
  };

  useEffect(() => {
    initDB();
  }, []);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/admin" element={
          <ProtectedRoute>
            <Header />
            <div className="flex flex-col md:flex-row w-full justify-center">
              <main
                className={`w-full h-screen md:w-[80%] sm:w-[100%] xs:w-[100%] pt-16 sm:pt-16 md:pt-14 lg:pt-20 px-2 lg:px-4 justify-center`}
              >
                <RequestsManagement />
              </main>
            </div>
          </ProtectedRoute>
        } />
        <Route path="/admin/document" element={
          <ProtectedRoute>
            <Header />
            <div className="flex flex-col md:flex-row w-full justify-center">
              <main
                className={`w-full h-screen md:w-[80%] sm:w-[100%] xs:w-[100%] pt-16 sm:pt-16 md:pt-14 lg:pt-20 px-2 lg:px-4 justify-center`}
              >
                <DocumentViewer />
              </main>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </Suspense>
  );
};

export default App;
