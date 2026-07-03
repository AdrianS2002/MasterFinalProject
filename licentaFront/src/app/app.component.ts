import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from "./header/header.component";
import { TransitionService } from './services/transition.service';
import { filter } from 'rxjs';
import { gsap } from 'gsap';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'licentaFront';
  constructor(private router: Router, private transitionService: TransitionService) {}

  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.transitionService.revealTransition().then(() => {
        gsap.set('.block', { visibility: 'hidden' });
      });
    });
  }
}
