// transition.service.ts
import { Injectable } from '@angular/core';
import { gsap } from 'gsap';

@Injectable({
  providedIn: 'root'
})
export class TransitionService {
  private ease = "power4.inOut";

  revealTransition(): Promise<void> {
    return new Promise((resolve) => {
      gsap.set(".block", { scaleY: 1 });
      gsap.to(".block", {
        scaleY: 0,
        duration: 1,
        stagger: {
          each: 0.1,
          from: "start",
          grid: "auto",
          axis: "x"
        },
        ease: this.ease,
        onComplete: resolve
      });
    });
  }

  animateTransition(): Promise<void> {
    return new Promise((resolve) => {
      gsap.set(".block", { visibility: "visible", scaleY: 0 });
      gsap.to(".block", {
        scaleY: 1,
        duration: 1,
        stagger: {
          each: 0.1,
          from: "start",
          grid: [2, 5],
          axis: "x"
        },
        ease: this.ease,
        onComplete: resolve
      });
    });
  }
}
