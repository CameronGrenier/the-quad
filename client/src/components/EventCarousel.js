import React from 'react';
import EventThumbnail from './EventThumbnail';
import './EventCarousel.css';

import Carousel from "react-multi-carousel";
import "react-multi-carousel/lib/styles.css";
import "./CustomCarousel.css";

const responsive = {
  desktop: {
    breakpoint: { max: 3000, min: 1024 },
    items: 4,
    slidesToSlide: 1,
  },
  tablet: {
    breakpoint: { max: 1024, min: 464 },
    items: 2,
    slidesToSlide: 1,
  },
  mobile: {
    breakpoint: { max: 464, min: 0 },
    items: 1,
    slidesToSlide: 1,
  }
};

function EventCarousel(props) {
  return (
    <Carousel
      swipeable={true}
      draggable={true}
      showDots={true}
      responsive={responsive}
      ssr={true}
      infinite={true}
      autoPlay={true}
      autoPlaySpeed={4000}
      keyBoardControl={true}
      customTransition="transform 0.5s ease-in-out"
      transitionDuration={700}
      containerClass="carousel-container"
      removeArrowOnDeviceType={["tablet", "mobile"]}
      deviceType={props.deviceType}
      renderDotsOutside={true}
      dotListClass="custom-dot-list-style"
      itemClass="carousel-item-padding-40-px"
    >
      {props.events && Array.isArray(props.events) && props.events.length > 0 ? (
        props.events.map((event) => (
          <EventThumbnail event={event} key={event.title} />
        ))
      ) : (
        <div>No events to display</div>
      )}
    </Carousel>
  );
}

export default EventCarousel;
