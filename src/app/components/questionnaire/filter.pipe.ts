import { Pipe, PipeTransform } from '@angular/core';
import { QuestionnaireOption } from '../../services/questionnaire-manager.service';

@Pipe({
  name: 'filter',
  standalone: true
})
export class FilterPipe implements PipeTransform {
  transform(items: QuestionnaireOption[], id: string): QuestionnaireOption | undefined {
    if (!items || !id) {
      return undefined;
    }
    return items.find(item => item.id === id);
  }
} 