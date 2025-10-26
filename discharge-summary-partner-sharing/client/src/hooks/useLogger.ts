import { useContext } from "react";
import { LoggerContext } from "../contexts";

export const useLogger = () => {
    const context = useContext(LoggerContext);
    if (context === undefined) {
        throw new Error('useLogger must be used within a LoggerProvider');
    }
    return context;
};