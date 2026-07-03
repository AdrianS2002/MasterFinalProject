import { Component, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css'
})
export class AboutComponent implements AfterViewInit {

  ngAfterViewInit(): void {
    const elements = document.querySelectorAll('.fade-in, .fade-out');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        } else {
          entry.target.classList.remove('in-view'); // opțional pt fade-out
        }
      });
    }, {
      threshold: 0.2
    });

    elements.forEach(el => observer.observe(el));
  }
}
