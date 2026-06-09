import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthRequired() {
  const navigate = useNavigate();
  useEffect(() => {
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    navigate('/auth');
  }, [navigate]);
  return null;
}
