import { Component, ViewChild, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { QuestionnaireComponent } from './components/questionnaire/questionnaire.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, QuestionnaireComponent],
  template: `
    <div class="app-container">
      <header>
        <h1>Formulary Order System</h1>
      </header>
      <main>
        <app-questionnaire #questionnaireComponent></app-questionnaire>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
      margin-bottom: 20px;
    }
  `]
})
export class AppComponent implements AfterViewInit, OnInit {
  @ViewChild('questionnaireComponent') questionnaireComponent!: QuestionnaireComponent;
  
  constructor(private route: ActivatedRoute) {}
  
  ngOnInit(): void {
    // Check for product selection in route parameters
    this.route.paramMap.subscribe(params => {
      const productName = params.get('productName');
      if (productName) {
        // Remember product for after view init
        this.productToSelect = this.mapProductNameToOption(productName);
      }
    });
  }
  
  private productToSelect: string | null = null;
  
  ngAfterViewInit(): void {
    // Timeout to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      // Select product from route parameter if available
      if (this.productToSelect) {
        this.selectProduct(this.productToSelect);
      }
    });
  }
  
  selectOxygenTherapy(): void {
    this.selectProduct('Oxygen Concentrator');
  }
  
  selectLCDTherapy(): void {
    this.selectProduct('LCD');
  }
  
  selectProduct(productName: string): void {
    if (this.questionnaireComponent) {
      this.questionnaireComponent.selectProduct(productName);
    }
  }
  
  private mapProductNameToOption(productName: string): string {
    // Map URL-friendly names to actual product names
    const productMap: { [key: string]: string } = {
      'oxygen-therapy': 'Oxygen Concentrator',
      'aed': 'AED',
      'cpap': 'CPAP',
      'wheelchair': 'Wheelchair',
      'lcd': 'LCD'
    };
    
    return productMap[productName.toLowerCase()] || productName;
  }
}
