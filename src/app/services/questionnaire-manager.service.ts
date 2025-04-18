import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface QuestionnaireOption {
  id: string;
  name: string;
  description: string;
}

export interface QuestionnaireData {
  questions: any[];
  coverageWarnings: any[];
}

export interface RuleSet {
  rules: any[];
}

@Injectable({
  providedIn: 'root'
})
export class QuestionnaireManagerService {
  private availableQuestionnairesSubject = new BehaviorSubject<QuestionnaireOption[]>([]);
  private selectedQuestionnaireSubject = new BehaviorSubject<QuestionnaireOption | null>(null);
  private questionnaireDataSubject = new BehaviorSubject<QuestionnaireData | null>(null);
  private rulesSubject = new BehaviorSubject<any[]>([]);
  
  // Define available questionnaires
  private questionnaireOptions: QuestionnaireOption[] = [
    {
      id: '1',
      name: 'AED Coverage Questionnaire',
      description: 'Questions to determine eligibility for Automated External Defibrillator coverage'
    },
    {
      id: '2',
      name: 'CPAP Coverage Questionnaire',
      description: 'Questions to determine eligibility for CPAP device coverage'
    },
    {
      id: '3',
      name: 'Wheelchair Coverage Questionnaire',
      description: 'Questions to determine eligibility for wheelchair coverage'
    },
    {
      id: '4',
      name: 'Oxygen Therapy Questionnaire',
      description: 'Questions to determine eligibility for oxygen concentrator coverage'
    },
    {
      id: '5',
      name: 'LCD Coverage Questionnaire',
      description: 'Questions to determine eligibility for Medicare LCD coverage'
    }
  ];

  constructor(private http: HttpClient) {
    // Initialize with available questionnaires
    this.availableQuestionnairesSubject.next(this.questionnaireOptions);
    
    // Select the first questionnaire by default
    if (this.questionnaireOptions.length > 0) {
      this.selectQuestionnaire(this.questionnaireOptions[0].id);
    }
  }

  getAvailableQuestionnaires(): Observable<QuestionnaireOption[]> {
    return this.availableQuestionnairesSubject.asObservable();
  }

  getSelectedQuestionnaire(): Observable<QuestionnaireOption | null> {
    return this.selectedQuestionnaireSubject.asObservable();
  }

  getQuestionnaireData(): Observable<QuestionnaireData | null> {
    return this.questionnaireDataSubject.asObservable();
  }

  getRules(): Observable<any[]> {
    return this.rulesSubject.asObservable();
  }

  selectQuestionnaire(id: string): void {
    const questionnaire = this.questionnaireOptions.find(q => q.id === id);
    if (questionnaire) {
      this.selectedQuestionnaireSubject.next(questionnaire);
      this.loadQuestionnaireData(id);
      this.loadRules(id);
    }
  }

  private loadQuestionnaireData(id: string): void {
    // Load the questionnaire data from the JSON file in assets
    this.http.get<QuestionnaireData>(`assets/questionnaires/questionnaire_${id}.json`)
      .pipe(catchError(() => of(null)))
      .subscribe(data => {
        if (data) {
          this.questionnaireDataSubject.next(data);
        }
      });
  }

  private loadRules(id: string): void {
    // Load the rules from the JSON file in assets
    this.http.get<any[]>(`assets/questionnaires/rules_${id}.json`)
      .pipe(catchError(() => of([])))
      .subscribe(rules => {
        if (rules) {
          this.rulesSubject.next(rules);
        }
      });
  }
} 