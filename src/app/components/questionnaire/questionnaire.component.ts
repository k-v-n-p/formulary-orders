import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RulesService, Question, CoverageWarning } from '../../services/rules.service';
import { QuestionnaireManagerService, QuestionnaireOption } from '../../services/questionnaire-manager.service';
import { FilterPipe } from './filter.pipe';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-questionnaire',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterPipe],
  templateUrl: './questionnaire.component.html',
  styleUrl: './questionnaire.component.scss'
})
export class QuestionnaireComponent implements OnInit {
  questions: Question[] = [];
  coverageWarnings: CoverageWarning[] = [];
  availableQuestionnaires: QuestionnaireOption[] = [];
  selectedQuestionnaireId: string = '';

  constructor(
    private rulesService: RulesService,
    private questionnaireManager: QuestionnaireManagerService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Get available questionnaires
    this.questionnaireManager.getAvailableQuestionnaires().subscribe(questionnaires => {
      this.availableQuestionnaires = questionnaires;
      if (questionnaires.length > 0 && !this.selectedQuestionnaireId) {
        this.selectedQuestionnaireId = questionnaires[0].id;
      }
    });
    
    // Get the currently selected questionnaire
    this.questionnaireManager.getSelectedQuestionnaire().subscribe(questionnaire => {
      if (questionnaire) {
        this.selectedQuestionnaireId = questionnaire.id;
      }
    });
    
    // Subscribe to question and warning updates
    this.rulesService.getQuestions().subscribe(questions => {
      // Initialize checkbox answers as arrays
      questions.forEach(q => {
        if (q.type === 'checkbox' && !q.answer) {
          q.answer = [];
        }
      });
      
      this.questions = questions;
    });

    this.rulesService.getCoverageWarnings().subscribe(warnings => {
      this.coverageWarnings = warnings;
    });
  }

  // Select a new questionnaire
  onQuestionnaireChange(): void {
    this.questionnaireManager.selectQuestionnaire(this.selectedQuestionnaireId);
    this.resetAnswers();
  }
  
  // Reset the current questionnaire
  resetQuestionnaire(): void {
    // Reset all answers in the rules service
    this.rulesService.resetQuestionnaire();
  }

  onAnswerQuestion(question: Question, answer: any): void {
    this.rulesService.answerQuestion(question.id, answer);
  }

  onCheckboxChange(question: Question, value: string, event: any): void {
    const checked = event.target.checked;
    
    // Initialize as empty array if not already an array
    if (!Array.isArray(question.answer)) {
      question.answer = [];
    }
    
    if (checked) {
      // Add the value to the array if it's not already there
      if (!question.answer.includes(value)) {
        question.answer.push(value);
      }
    } else {
      // Remove the value from the array
      question.answer = question.answer.filter((item: string) => item !== value);
    }
    
    // Update the question
    this.rulesService.answerQuestion(question.id, question.answer);
  }
  
  // Get warnings related to a specific question
  getRelatedWarnings(question: Question): CoverageWarning[] {
    // Return warnings that have their questionId matching this question's id
    return this.coverageWarnings.filter(warning => 
      warning.questionId === question.id && warning.visible
    );
  }
  
  // Get warnings not associated with any specific question
  getUnrelatedWarnings(): CoverageWarning[] {
    // Return warnings that don't have a questionId property and are visible
    return this.coverageWarnings.filter(warning => 
      !warning.questionId && warning.visible
    );
  }

  // Method to handle product selection from buttons
  selectProduct(productName: string): void {
    // Find the questionnaire by product name
    this.selectQuestionnaireByProduct(productName);
  }

  // Select questionnaire by product name
  selectQuestionnaireByProduct(productName: string): void {
    // Find questionnaire data by loading and checking each one
    this.http.get<any[]>('assets/questionnaires/index.json')
      .pipe(catchError(() => of([])))
      .subscribe(questionnaires => {
        if (!questionnaires || questionnaires.length === 0) {
          // Fallback method: Try each questionnaire one by one
          this.findProductInQuestionnaires(productName);
        } else {
          // Use the index if available
          const match = questionnaires.find(q => q.product === productName);
          if (match && match.id) {
            this.selectedQuestionnaireId = match.id;
            this.onQuestionnaireChange();
          }
        }
      });
  }
  
  private findProductInQuestionnaires(productName: string): void {
    // If we don't have an index, check each questionnaire manually
    const checkQuestionnaire = (id: string) => {
      this.http.get<any>(`assets/questionnaires/questionnaire_${id}.json`)
        .pipe(catchError(() => of(null)))
        .subscribe(data => {
          if (data && data.product === productName) {
            this.selectedQuestionnaireId = id;
            this.onQuestionnaireChange();
          } else if (id < '4') {
            // Try the next questionnaire
            checkQuestionnaire((parseInt(id) + 1).toString());
          }
        });
    };
    
    // Start with the first questionnaire
    checkQuestionnaire('1');
  }

  resetAnswers(): void {
    // Reset all question answers
    this.questions.forEach(question => {
      if (question.type === 'checkbox') {
        question.answer = [];
      } else {
        question.answer = null;
      }
      
      // Re-evaluate rules after resetting
      this.onQuestionAnswered(question);
    });
  }
  
  onQuestionAnswered(question: Question): void {
    // Notify the rules service that a question was answered
    this.rulesService.answerQuestion(question.id, question.answer);
  }
}
