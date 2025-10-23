import React, { useRef, useEffect } from 'react';
import LottieView from 'lottie-react-native';

const AnimatedActivityIndicator = (props) => {
  const animationRef = useRef(null);

  useEffect(() => {
    // Start animation when component mounts
    if (animationRef.current) {
      animationRef.current.play();
    }

    // Cleanup function to stop animation when component unmounts
    return () => {
      if (animationRef.current) {
        animationRef.current.pause();
      }
    };
  }, []);

  return (
    <LottieView
      ref={animationRef}
      source={require("../animations/loading_circle.json")}
      autoPlay
      loop
      style={props.style}
    />
  );
};

export default AnimatedActivityIndicator;
