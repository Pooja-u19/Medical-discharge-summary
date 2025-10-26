import React, { useEffect } from 'react';
import { useLoader } from '../../../hooks';

const LoadingFallback: React.FC = () => {
    const { showLoader, hideLoader } = useLoader();

    useEffect(() => {
        showLoader();
        return () => hideLoader();
    }, []);
    return null;
}

export default LoadingFallback;
